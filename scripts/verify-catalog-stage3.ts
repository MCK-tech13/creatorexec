/**
 * Stage 3: catalog is the source of truth for sprint products.
 * - CSV upload upserts into catalog, then sprint rebuilds from catalog
 * - Catalog-only samples survive alongside CSV products
 * - Legacy scheduleMode `sample` coerces to `full`
 *
 * Run: npx tsx scripts/verify-catalog-stage3.ts
 */
import type { MergedProduct, SampleProduct, SprintConfig } from '../src/types'
import { TIER_REVIEW_VIDEO_COUNT } from '../src/types'
import { buildFilmingSchedule } from '../src/lib/schedule/scheduleBuilder'
import {
  buildSprintProductsFromCatalog,
  normalizeScheduleMode,
} from '../src/lib/catalog/catalogSprint'
import {
  clearProductCatalog,
  loadProductCatalog,
  upsertCatalogFromMergedProducts,
  upsertCatalogFromSampleProducts,
} from '../src/lib/catalog/productCatalogStorage'
import { clearDataStore, hydrateDataStore } from '../src/lib/supabase/dataStore'
import { emptyUserEngagement } from '../src/types/userEngagement'

const memoryStorage = new Map<string, string>()
;(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (key) => memoryStorage.get(key) ?? null,
  setItem: (key, value) => {
    memoryStorage.set(key, value)
  },
  removeItem: (key) => {
    memoryStorage.delete(key)
  },
  clear: () => {
    memoryStorage.clear()
  },
  key: () => null,
  length: 0,
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function emptySnapshot() {
  return {
    trialProgress: {},
    brandDeals: [],
    incomeTracker: [],
    productScoutEntries: [],
    productCatalog: [],
    onboardingProfile: null,
    sprintEntrySeen: false,
    welcomeSeen: false,
    sprintStartSnapshot: null,
    sprintPreviousSnapshot: null,
    currentSprintState: null,
    sprintHistory: [],
    userEngagement: emptyUserEngagement(),
  }
}

function resetStore(): void {
  clearDataStore()
  hydrateDataStore('user-stage3', emptySnapshot())
  clearProductCatalog()
}

function mockSample(id: string, name: string, favorite = false): SampleProduct {
  return {
    id,
    productName: name,
    brand: 'BrandCo',
    dateReceived: '2026-07-01',
    type: favorite ? 'favorite' : 'sample',
  }
}

function mockCsvProduct(
  id: string,
  name: string,
  productId: string,
  opts?: Partial<MergedProduct>,
): MergedProduct {
  return {
    id,
    productName: name,
    productId,
    gmv: 120,
    commission: 18,
    itemsSold: 8,
    orderCount: 6,
    videosFilmed: 0,
    score: 0,
    tier: 'Rising',
    rankInTier: 0,
    inRotation: true,
    isManual: false,
    ...opts,
  }
}

const sprintConfig: SprintConfig = { videosPerDay: 6, sprintDays: 7 }

function runLegacySampleModeCoerces(): void {
  console.log('\n=== Legacy scheduleMode sample coerces to full ===')
  assert(normalizeScheduleMode('sample') === 'full', 'sample → full')
  assert(normalizeScheduleMode('full') === 'full', 'full stays full')
  assert(normalizeScheduleMode('momentum') === 'momentum', 'momentum stays')
  assert(normalizeScheduleMode(null) === 'full', 'null → full')
  console.log('PASS')
}

function runCsvReconcileKeepsCatalogSamples(): void {
  console.log('\n=== CSV upload reconciles into catalog; samples stay in sprint ===')
  resetStore()

  const sampleId = '11111111-1111-4111-8111-111111111111'
  upsertCatalogFromSampleProducts([mockSample(sampleId, 'Gifted Serum', true)])
  assert(loadProductCatalog().length === 1, 'catalog has sample')

  const csvId = '22222222-2222-4222-8222-222222222222'
  const csvProducts = [
    mockCsvProduct(csvId, 'Report Hero', 'tiktok-hero-1', {
      commission: 40,
      itemsSold: 20,
      tier: 'Anchor',
    }),
  ]
  // Mimic finishUpload: upsert CSV, then rebuild sprint from catalog.
  upsertCatalogFromMergedProducts(csvProducts, 'csv')
  const sprint = buildSprintProductsFromCatalog(undefined, { mode: 'full' })

  assert(loadProductCatalog().length === 2, 'catalog has sample + CSV product')
  assert(
    sprint.some((p) => p.id === sampleId),
    'sprint includes catalog sample after CSV reconcile',
  )
  assert(
    sprint.some((p) => p.id === csvId || p.productId === 'tiktok-hero-1'),
    'sprint includes CSV product',
  )

  const sample = sprint.find((p) => p.id === sampleId)!
  assert(sample.tier === 'Test', 'zero-sales sample stays Test')
  assert(sample.isFavorite === true, 'favorite flag survives reconcile')

  const schedule = buildFilmingSchedule(sprint, sprintConfig, [], new Set())
  const sampleSlots = schedule
    .flatMap((d) => d.videos)
    .filter((v) => v.productKey === sampleId).length
  assert(
    sampleSlots === TIER_REVIEW_VIDEO_COUNT,
    `sample still gets full 6-video trial after CSV, got ${sampleSlots}`,
  )
  console.log('PASS')
}

function runMomentumRebuildFromCatalog(): void {
  console.log('\n=== Momentum mode rebuilds from catalog after CSV upsert ===')
  resetStore()

  upsertCatalogFromSampleProducts([
    mockSample('33333333-3333-4333-8333-333333333333', 'Momentum Sample'),
  ])
  upsertCatalogFromMergedProducts(
    [
      mockCsvProduct('44444444-4444-4444-8444-444444444444', 'Warm Seller', 'tiktok-warm', {
        itemsSold: 5,
        commission: 12,
      }),
    ],
    'csv',
  )

  const sprint = buildSprintProductsFromCatalog(undefined, { mode: 'momentum' })
  assert(sprint.length === 2, 'both products in momentum sprint')
  assert(
    sprint.every((p) => p.tier === 'Rising' || p.tier === 'Test'),
    'momentum has no Anchor/Cut',
  )
  assert(
    sprint.find((p) => p.productName.includes('Warm'))?.tier === 'Rising',
    '3+ items → Rising in momentum',
  )
  assert(
    sprint.find((p) => p.productName.includes('Momentum Sample'))?.tier === 'Test',
    'sample → Test in momentum',
  )
  console.log('PASS')
}

function runTestSpreadRotatesAcrossProducts(): void {
  console.log('\n=== Test spread rotates preferred days (no Mon/Wed/Fri pile-up) ===')
  resetStore()

  const tests: MergedProduct[] = Array.from({ length: 6 }, (_, i) => ({
    id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${i}`,
    productName: `Test ${i + 1}`,
    productId: `t${i}`,
    gmv: 0,
    commission: 0,
    itemsSold: 0,
    orderCount: 0,
    videosFilmed: 0,
    score: 0,
    tier: 'Test' as const,
    rankInTier: i,
    inRotation: true,
    isManual: true,
  }))

  const schedule = buildFilmingSchedule(
    tests,
    { videosPerDay: 15, sprintDays: 7 },
    [],
    new Set(),
  )
  const counts = schedule.map((day) => day.videos.length)
  const min = Math.min(...counts)
  const max = Math.max(...counts)
  assert(counts.every((count) => count <= 15), 'never exceeds videosPerDay')
  assert(min > 0, `no empty days after rotation, got ${JSON.stringify(counts)}`)
  assert(
    max - min <= 3,
    `day counts should be roughly even, got ${JSON.stringify(counts)} (spread ${max - min})`,
  )

  // Legacy bug: all Tests on [0,2,4] → [12,0,12,0,12,0,0]
  assert(
    !(counts[1] === 0 && counts[3] === 0 && counts[5] === 0),
    'must not leave Tue/Thu/Sat empty while Mon/Wed/Fri are loaded',
  )
  console.log('PASS', counts)
}

try {
  runLegacySampleModeCoerces()
  runCsvReconcileKeepsCatalogSamples()
  runMomentumRebuildFromCatalog()
  runTestSpreadRotatesAcrossProducts()
  console.log('\nAll Stage 3 catalog reconcile checks passed.')
} catch (error) {
  console.error('\nVERIFICATION FAILED:', error)
  process.exit(1)
}

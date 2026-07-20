/**
 * Stage 1 durable product catalog:
 * - CRUD via in-memory dataStore
 * - one-time backfill from current sprint products/samples
 * - resetSprintState clears sprint workspace only (catalog survives)
 * - dual-write helpers for merged + sample products
 *
 * Run: npx tsx scripts/verify-product-catalog.ts
 */
import type { MergedProduct, SampleProduct } from '../src/types'
import {
  backfillCatalogFromSprintState,
  catalogProductFromMerged,
  catalogProductFromSample,
  clearProductCatalog,
  loadProductCatalog,
  saveProductCatalog,
  upsertCatalogFromMergedProducts,
  upsertCatalogFromSampleProducts,
} from '../src/lib/catalog/productCatalogStorage'
import {
  clearDataStore,
  getUserDataSnapshot,
  hydrateDataStore,
  updateCurrentSprintState,
} from '../src/lib/supabase/dataStore'
import { emptyUserEngagement } from '../src/types/userEngagement'
import type { CurrentSprintState } from '../src/types/currentSprint'

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

function mockMerged(
  id: string,
  name: string,
  opts?: Partial<MergedProduct>,
): MergedProduct {
  return {
    id,
    productName: name,
    productId: opts?.productId ?? `pid-${id}`,
    gmv: opts?.gmv ?? 100,
    commission: opts?.commission ?? 10,
    itemsSold: opts?.itemsSold ?? 5,
    orderCount: opts?.orderCount ?? 2,
    videosFilmed: opts?.videosFilmed ?? 0,
    score: opts?.score ?? 10,
    tier: opts?.tier ?? 'Test',
    rankInTier: opts?.rankInTier ?? 1,
    inRotation: opts?.inRotation ?? true,
    isManual: opts?.isManual ?? false,
  }
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

function simulateResetSprintState(): void {
  // Mirrors CreatorExecApp.resetSprintState: clears sprint workspace only.
  updateCurrentSprintState(null)
}

function runCrudTest(): void {
  console.log('\n=== Catalog CRUD ===')
  clearDataStore()
  hydrateDataStore('user-catalog', emptySnapshot())

  const product = catalogProductFromMerged(
    mockMerged('11111111-1111-4111-8111-111111111111', 'Glow Serum', {
      productId: 'tiktok-123',
      commission: 42,
    }),
  )
  saveProductCatalog([product])
  assert(loadProductCatalog().length === 1, 'save should store one product')
  assert(
    loadProductCatalog()[0].externalProductId === 'tiktok-123',
    'external TikTok id should be stored',
  )

  const updated = {
    ...loadProductCatalog()[0],
    commission: 99,
    displayName: 'Glow Serum Pro',
  }
  saveProductCatalog([updated])
  assert(loadProductCatalog()[0].commission === 99, 'update should overwrite metrics')
  assert(
    loadProductCatalog()[0].displayName === 'Glow Serum Pro',
    'update should overwrite display name',
  )

  clearProductCatalog()
  assert(loadProductCatalog().length === 0, 'clear should empty catalog')
  console.log('PASS')
}

function runDualWriteAndBackfillTest(): void {
  console.log('\n=== Dual-write + one-time backfill ===')
  clearDataStore()
  hydrateDataStore('user-catalog', emptySnapshot())

  const merged = [
    mockMerged('22222222-2222-4222-8222-222222222222', 'CSV Product', {
      productId: 'csv-1',
      commission: 20,
    }),
  ]
  upsertCatalogFromMergedProducts(merged)
  assert(loadProductCatalog().length === 1, 'CSV dual-write should add catalog row')

  const samples = [
    mockSample('33333333-3333-4333-8333-333333333333', 'Free Sample', false),
    mockSample('44444444-4444-4444-8444-444444444444', 'Favorite Lip Oil', true),
  ]
  upsertCatalogFromSampleProducts(samples)
  const catalog = loadProductCatalog()
  assert(catalog.length === 3, 'sample dual-write should add both samples')
  const favorite = catalog.find((p) => p.id === '44444444-4444-4444-8444-444444444444')
  assert(favorite?.isFavorite === true, 'favorite sample should set isFavorite')
  assert(favorite?.source === 'sample', 'sample dual-write source should be sample')

  // Backfill is a no-op when catalog already has rows.
  const skip = backfillCatalogFromSprintState({
    products: [mockMerged('55555555-5555-4555-8555-555555555555', 'Should Not Appear')],
    sampleProducts: [],
  })
  assert(skip.backfilled === false, 'backfill should skip when catalog is non-empty')
  assert(
    !loadProductCatalog().some((p) => p.id === '55555555-5555-4555-8555-555555555555'),
    'skipped backfill must not insert new rows',
  )

  // Empty catalog + sprint content → backfill once.
  clearProductCatalog()
  const sprintProducts = [
    mockMerged('66666666-6666-4666-8666-666666666666', 'Sprint CSV', {
      productId: 'sprint-1',
    }),
  ]
  const sprintSamples = [mockSample('77777777-7777-4777-8777-777777777777', 'Sprint Sample')]
  const filled = backfillCatalogFromSprintState({
    products: sprintProducts,
    sampleProducts: sprintSamples,
  })
  assert(filled.backfilled === true, 'empty catalog should backfill from sprint')
  assert(loadProductCatalog().length === 2, 'backfill should copy products + samples')
  assert(
    loadProductCatalog().every((p) => p.source === 'backfill'),
    'backfill entries should be marked source=backfill',
  )

  // Sentinel productIds are not stored as external IDs.
  const sampleMerged = catalogProductFromSample(
    mockSample('88888888-8888-4888-8888-888888888888', 'No External'),
  )
  assert(sampleMerged.externalProductId === null, 'sample rows have no external id')
  const manual = catalogProductFromMerged(
    mockMerged('99999999-9999-4999-8999-999999999999', 'Manual', {
      productId: 'manual',
      isManual: true,
    }),
  )
  assert(manual.externalProductId === null, 'manual sentinel must not become external id')
  console.log('PASS')
}

function runSurvivesResetTest(): void {
  console.log('\n=== Catalog survives Start Over / resetSprintState ===')
  clearDataStore()
  hydrateDataStore('user-catalog', emptySnapshot())

  upsertCatalogFromMergedProducts([
    mockMerged('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Keep Me', {
      productId: 'keep-1',
      commission: 15,
    }),
  ])
  upsertCatalogFromSampleProducts([
    mockSample('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Keep Sample'),
  ])

  const sprint: CurrentSprintState = {
    stage: 'schedule',
    scheduleMode: 'full',
    fileName: null,
    sprintConfig: { videosPerDay: 5, sprintDays: 7 },
    products: [
      mockMerged('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Keep Me', {
        productId: 'keep-1',
      }),
    ],
    deadlineProducts: [],
    excludedProductKeys: [],
    sampleProducts: [mockSample('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Keep Sample')],
    schedule: [],
    filmingProgress: {},
  }
  updateCurrentSprintState(sprint)
  assert(getUserDataSnapshot().currentSprintState !== null, 'sprint state should be set')
  assert(loadProductCatalog().length === 2, 'catalog should have 2 products before reset')

  simulateResetSprintState()

  assert(getUserDataSnapshot().currentSprintState === null, 'sprint workspace should clear')
  assert(
    loadProductCatalog().length === 2,
    'durable catalog must survive resetSprintState',
  )
  assert(
    loadProductCatalog().some((p) => p.displayName === 'Keep Me'),
    'CSV catalog row must survive',
  )
  assert(
    loadProductCatalog().some((p) => p.displayName === 'Keep Sample'),
    'sample catalog row must survive',
  )
  console.log('PASS')
}

function runExistingModesStillCompatible(): void {
  console.log('\n=== Existing CSV / sample dual-write compatibility ===')
  clearDataStore()
  hydrateDataStore('user-catalog', emptySnapshot())

  // Simulate finishUpload dual-write (CSV path).
  const csvTiered = [
    mockMerged('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'CSV Anchor', {
      productId: 'csv-a',
      tier: 'Anchor',
      commission: 200,
      itemsSold: 40,
    }),
    mockMerged('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'CSV Test', {
      productId: 'csv-t',
      tier: 'Test',
      commission: 2,
      itemsSold: 1,
    }),
  ]
  upsertCatalogFromMergedProducts(csvTiered)
  assert(loadProductCatalog().length === 2, 'CSV upload dual-write should catalog both')

  // Simulate sample build dual-write without wiping CSV catalog rows.
  const samples = [mockSample('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'New Sample')]
  upsertCatalogFromSampleProducts(samples)
  assert(loadProductCatalog().length === 3, 'sample dual-write should not wipe CSV catalog')
  assert(
    loadProductCatalog().some((p) => p.externalProductId === 'csv-a'),
    'CSV external ids remain after sample dual-write',
  )

  // Re-uploading the same TikTok productId must update, not duplicate.
  upsertCatalogFromMergedProducts([
    mockMerged('name:glowserum', 'CSV Anchor Updated', {
      productId: 'csv-a',
      tier: 'Anchor',
      commission: 250,
      itemsSold: 50,
    }),
  ])
  const csvRows = loadProductCatalog().filter((p) => p.externalProductId === 'csv-a')
  assert(csvRows.length === 1, 're-upload with same TikTok id must not duplicate')
  assert(csvRows[0].commission === 250, 're-upload should refresh metrics')
  assert(loadProductCatalog().length === 3, 'catalog size unchanged after CSV re-upsert')
  console.log('PASS')
}

/**
 * Simulates the Start Over wipe bug: replace-all persist with [] deleted DB rows.
 * New contract: empty persist is a no-op; only clearProductCatalogRows wipes.
 */
async function runPersistEmptyDoesNotWipeTest(): Promise<void> {
  console.log('\n=== Persist empty must not wipe user_products ===')

  const { persistProductCatalog, clearProductCatalogRows } = await import(
    '../src/lib/supabase/persist'
  )

  type Row = { id: string; user_id: string; display_name: string }
  const db = new Map<string, Row>()

  const mockClient = {
    from(table: string) {
      assert(table === 'user_products', `unexpected table ${table}`)
      return {
        upsert(rows: Row[]) {
          for (const row of rows) db.set(row.id, row)
          return Promise.resolve({ error: null })
        },
        delete() {
          return {
            eq(_col: string, userId: string) {
              for (const [id, row] of db) {
                if (row.user_id === userId) db.delete(id)
              }
              return Promise.resolve({ error: null })
            },
            in(_col: string, ids: string[]) {
              for (const id of ids) db.delete(id)
              return Promise.resolve({ error: null })
            },
          }
        },
        select() {
          return {
            eq() {
              return Promise.resolve({
                data: [...db.values()].map((row) => ({ id: row.id })),
                error: null,
              })
            },
          }
        },
      }
    },
  }

  const product = catalogProductFromMerged(
    mockMerged('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Must Survive', {
      productId: 'survive-1',
    }),
  )

  // @ts-expect-error minimal mock client
  await persistProductCatalog(mockClient, 'user-1', [product])
  assert(db.size === 1, 'upsert should insert catalog row')

  // Simulate the Start Over race: persist with empty in-memory catalog.
  // @ts-expect-error minimal mock client
  await persistProductCatalog(mockClient, 'user-1', [])
  assert(db.size === 1, 'empty persist must NOT delete user_products rows')

  // Explicit onboarding clear still wipes.
  // @ts-expect-error minimal mock client
  await clearProductCatalogRows(mockClient, 'user-1')
  assert(db.size === 0, 'clearProductCatalogRows must delete all rows for user')

  console.log('PASS')
}

async function main(): Promise<void> {
  runCrudTest()
  runDualWriteAndBackfillTest()
  runSurvivesResetTest()
  runExistingModesStillCompatible()
  await runPersistEmptyDoesNotWipeTest()
  console.log('\nAll product catalog Stage 1 checks passed.')
}

main().catch((error) => {
  console.error('\nVERIFICATION FAILED:', error)
  process.exit(1)
})

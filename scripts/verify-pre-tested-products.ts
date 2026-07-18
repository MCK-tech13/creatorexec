/**
 * Verifies "Already tested this product?" opt-in:
 * - Explicit mark completes the 6-video trial and skips slot reservation
 * - Low performers promote to Cut from sales data (not held in Test)
 * - Genuinely new Test products still get the full trial by default
 * - On re-upload, hydrate + re-tier preserves the opt-in
 *
 * Run: npx tsx scripts/verify-pre-tested-products.ts
 */
import type { MergedProduct } from '../src/types'
import { TIER_REVIEW_VIDEO_COUNT } from '../src/types'
import { tierProducts } from '../src/lib/analysis/tierEngine'
import { retierProductsForMode } from '../src/lib/analysis/momentumMode'
import { buildFilmingSchedule } from '../src/lib/schedule/scheduleBuilder'
import {
  hydrateProductsTrialProgress,
  selectActiveTrialProducts,
  testSlotsForProduct,
} from '../src/lib/schedule/trialProgress'
import type { TrialProgressStore } from '../src/lib/schedule/trialProgressStorage'
import { trialStorageKey } from '../src/lib/schedule/trialProgressStorage'

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

function baseProduct(
  overrides: Partial<MergedProduct> & Pick<MergedProduct, 'id' | 'productName'>,
): Omit<MergedProduct, 'score' | 'tier' | 'rankInTier'> {
  return {
    productId: `pid-${overrides.id}`,
    gmv: 100,
    commission: 10,
    itemsSold: 5,
    orderCount: 2,
    videosFilmed: 0,
    inRotation: true,
    isManual: false,
    ...overrides,
  }
}

function countProductVideos(
  schedule: ReturnType<typeof buildFilmingSchedule>,
  productId: string,
): number {
  return schedule.reduce(
    (sum, day) => sum + day.videos.filter((v) => v.productKey === productId).length,
    0,
  )
}

/** Simulate CSV upload: tier with filmed=0, hydrate trial progress, re-tier. */
function uploadWithTrialHydration(
  products: Omit<MergedProduct, 'score' | 'tier' | 'rankInTier'>[],
  store: TrialProgressStore,
): MergedProduct[] {
  const tiered = tierProducts(products.map((p) => ({ ...p, videosFilmed: 0 })))
  const hydrated = hydrateProductsTrialProgress(tiered, store, { persist: false })
  return retierProductsForMode(hydrated, 'full')
}

function runFreshTestStillGetsTrial(): void {
  console.log('\n=== Fresh Test products still get the 6-video trial (default) ===')
  const anchors = [
    baseProduct({ id: 'a1', productName: 'Anchor A', commission: 200, itemsSold: 40, gmv: 2000 }),
    baseProduct({ id: 'a2', productName: 'Anchor B', commission: 180, itemsSold: 35, gmv: 1800 }),
    baseProduct({ id: 'a3', productName: 'Anchor C', commission: 160, itemsSold: 30, gmv: 1600 }),
  ]
  const freshTest = baseProduct({
    id: 't-new',
    productName: 'Brand new test',
    commission: 1,
    itemsSold: 1,
    gmv: 10,
  })
  const tiered = tierProducts([...anchors, freshTest])
  const test = tiered.find((p) => p.id === 't-new')
  assert(test?.tier === 'Test', 'New low-sales product should start in Test')
  assert(test?.videosFilmed === 0, 'Fresh product must start at 0 videos filmed')
  assert(
    testSlotsForProduct(test!) === TIER_REVIEW_VIDEO_COUNT,
    'Fresh Test product should reserve the full 6-video trial',
  )

  const schedule = buildFilmingSchedule(tiered, { videosPerDay: 8, sprintDays: 7 })
  assert(
    countProductVideos(schedule, 't-new') === TIER_REVIEW_VIDEO_COUNT,
    'Schedule should place all 6 trial videos for a fresh Test product',
  )
  console.log('PASS')
}

function runAlreadyTestedSkipsTrialSlots(): void {
  console.log('\n=== Already-tested opt-in skips trial slot reservation ===')
  const anchors = [
    baseProduct({ id: 'a1', productName: 'Anchor A', commission: 200, itemsSold: 40, gmv: 2000 }),
    baseProduct({ id: 'a2', productName: 'Anchor B', commission: 180, itemsSold: 35, gmv: 1800 }),
    baseProduct({ id: 'a3', productName: 'Anchor C', commission: 160, itemsSold: 30, gmv: 1600 }),
  ]
  const preTested = baseProduct({
    id: 't-pre',
    productName: 'Pre-tested product',
    commission: 2,
    itemsSold: 1,
    gmv: 20,
    videosFilmed: TIER_REVIEW_VIDEO_COUNT,
  })
  const fresh = baseProduct({
    id: 't-fresh',
    productName: 'Still needs trial',
    commission: 1.5,
    itemsSold: 1,
    gmv: 15,
  })

  const tiered = tierProducts([...anchors, preTested, fresh])
  const marked = tiered.find((p) => p.id === 't-pre')!
  const unmarked = tiered.find((p) => p.id === 't-fresh')!

  assert(marked.tier === 'Test', 'Low-sales pre-tested product can remain Test by sales rules')
  assert(testSlotsForProduct(marked) === 0, 'Already-tested product must reserve 0 trial slots')
  assert(
    testSlotsForProduct(unmarked) === TIER_REVIEW_VIDEO_COUNT,
    'Unmarked Test product must still get the full trial',
  )

  const active = selectActiveTrialProducts(tiered.filter((p) => p.tier === 'Test'))
  assert(
    active.every((p) => p.id !== 't-pre'),
    'Already-tested product must not be an active trial product',
  )
  assert(
    active.some((p) => p.id === 't-fresh'),
    'Unmarked Test product must remain eligible for trial scheduling',
  )

  const schedule = buildFilmingSchedule(tiered, { videosPerDay: 8, sprintDays: 7 })
  assert(
    countProductVideos(schedule, 't-pre') === 0,
    'Already-tested product should not appear in the guaranteed trial schedule',
  )
  assert(
    countProductVideos(schedule, 't-fresh') === TIER_REVIEW_VIDEO_COUNT,
    'Unmarked Test product should still get all trial videos',
  )
  console.log('PASS')
}

function runAlreadyTestedPromotesLowPerformerToCut(): void {
  console.log('\n=== Already-tested low performer promotes to Cut from sales data ===')
  // Build a catalog where one product is clearly bottom-percentile but has enough
  // items sold that the only reason it would stay Test is the 6-video trial hold.
  const strong = Array.from({ length: 8 }, (_, i) =>
    baseProduct({
      id: `s${i}`,
      productName: `Strong ${i}`,
      commission: 100 - i,
      itemsSold: 30 - i,
      gmv: 1000 - i * 10,
    }),
  )
  const weak = baseProduct({
    id: 'weak',
    productName: 'Weak seller',
    commission: 3,
    itemsSold: 5,
    gmv: 40,
  })

  const heldInTest = tierProducts([...strong, weak])
  const before = heldInTest.find((p) => p.id === 'weak')!
  assert(before.tier === 'Test', 'Low-score product with <6 videos should be held in Test')
  assert(before.videosFilmed === 0, 'Should start with no filmed trial progress')

  const afterMark = tierProducts([
    ...strong,
    { ...weak, videosFilmed: TIER_REVIEW_VIDEO_COUNT },
  ])
  const promoted = afterMark.find((p) => p.id === 'weak')!
  assert(
    promoted.tier === 'Cut',
    'After already-tested mark, low performer should become Cut from sales score',
  )
  assert(
    testSlotsForProduct(promoted) === 0,
    'Cut product after already-tested mark must not reserve trial slots',
  )
  console.log('PASS')
}

function runReuploadPreservesAlreadyTestedOptIn(): void {
  console.log('\n=== Re-upload hydrate + re-tier preserves already-tested opt-in ===')
  const strong = Array.from({ length: 8 }, (_, i) =>
    baseProduct({
      id: `s${i}`,
      productName: `Strong ${i}`,
      commission: 100 - i,
      itemsSold: 30 - i,
      gmv: 1000 - i * 10,
    }),
  )
  const weak = baseProduct({
    id: 'weak',
    productName: 'Weak seller',
    commission: 3,
    itemsSold: 5,
    gmv: 40,
  })

  // First appearance: tier as Test (trial hold). Opt-in is stored as manual trial complete.
  const firstPass = tierProducts([...strong, weak])
  const firstWeak = firstPass.find((p) => p.id === 'weak')!
  assert(firstWeak.tier === 'Test', 'First upload should place weak product in Test')

  // Same shape setTrialVideosFilmed / markProductAlreadyTested writes for the opt-in.
  const store: TrialProgressStore = {
    [trialStorageKey(firstWeak)]: {
      videosFilmed: TIER_REVIEW_VIDEO_COUNT,
      source: 'manual',
    },
  }

  // Second CSV upload: products come in with videosFilmed=0 again.
  const reuploaded = uploadWithTrialHydration([...strong, weak], store)
  const restored = reuploaded.find((p) => p.id === 'weak')!

  assert(
    restored.videosFilmed === TIER_REVIEW_VIDEO_COUNT,
    'Hydration should restore already-tested videosFilmed=6',
  )
  assert(
    restored.tier === 'Cut',
    'After hydrate + re-tier, already-tested weak product should be Cut (not stuck in Test)',
  )
  assert(testSlotsForProduct(restored) === 0, 'Restored already-tested product must skip trial')

  // Control: without the opt-in store entry, weak product stays in Test for trial.
  const withoutOptIn = uploadWithTrialHydration([...strong, weak], {})
  const stillTrial = withoutOptIn.find((p) => p.id === 'weak')!
  assert(stillTrial.tier === 'Test', 'Without opt-in, weak product stays in Test')
  assert(stillTrial.videosFilmed === 0, 'Without opt-in, videosFilmed stays 0')
  assert(
    testSlotsForProduct(stillTrial) === TIER_REVIEW_VIDEO_COUNT,
    'Without opt-in, full trial must still be reserved',
  )
  console.log('PASS')
}

try {
  runFreshTestStillGetsTrial()
  runAlreadyTestedSkipsTrialSlots()
  runAlreadyTestedPromotesLowPerformerToCut()
  runReuploadPreservesAlreadyTestedOptIn()
  console.log('\nAll pre-tested product checks passed.')
} catch (error) {
  console.error('\nVERIFICATION FAILED:', error)
  process.exit(1)
}

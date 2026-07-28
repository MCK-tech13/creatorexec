/**
 * Stage 2: catalog-driven sprint scheduling
 * - No-sales catalog products → Test via tierEngine → full 6-video trial
 * - Favorites = soft trial priority (never forced Rising/Anchor)
 * - Sprint rebuilds from catalog after Start Over / sprint clear
 * - Already-tested keyed by durable catalog UUID
 *
 * Run: npx tsx scripts/verify-catalog-stage2.ts
 */
import type { MergedProduct, SampleProduct, SprintConfig } from '../src/types'
import { TIER_REVIEW_VIDEO_COUNT } from '../src/types'
import { tierProducts } from '../src/lib/analysis/tierEngine'
import { buildFilmingSchedule } from '../src/lib/schedule/scheduleBuilder'
import {
  hydrateProductsTrialProgress,
  markProductAlreadyTested,
  selectActiveTrialProducts,
  testSlotsForProduct,
} from '../src/lib/schedule/trialProgress'
import { trialStorageKey } from '../src/lib/schedule/trialProgressStorage'
import { sampleProductsToMerged } from '../src/lib/schedule/sampleModeSchedule'
import {
  clearProductCatalog,
  loadProductCatalog,
  saveProductCatalog,
  upsertCatalogFromSampleProducts,
} from '../src/lib/catalog/productCatalogStorage'
import {
  buildSprintProductsFromCatalog,
  mergedDraftFromCatalog,
} from '../src/lib/catalog/catalogSprint'
import { persistScheduleFilmedDelta } from '../src/lib/schedule/scheduleFilmingTrialSync'
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
    catalogMergeHistory: [],
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
  hydrateDataStore('user-stage2', emptySnapshot())
  memoryStorage.clear()
}

function mockSample(
  id: string,
  name: string,
  favorite = false,
  firstVideoDeadline?: string,
): SampleProduct {
  return {
    id,
    productName: name,
    brand: 'BrandCo',
    dateReceived: '2026-07-01',
    type: favorite ? 'favorite' : 'sample',
    ...(firstVideoDeadline ? { firstVideoDeadline } : {}),
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

const sprintConfig: SprintConfig = { videosPerDay: 5, sprintDays: 7 }

function runZeroSalesFullTrial(): void {
  console.log('\n=== No-sales catalog product gets full 6-video Test trial ===')
  resetStore()

  const samples = [
    mockSample('11111111-1111-4111-8111-111111111111', 'Zero Sales Serum'),
  ]
  upsertCatalogFromSampleProducts(samples)
  const sprintProducts = buildSprintProductsFromCatalog()

  assert(sprintProducts.length === 1, 'catalog should yield one sprint product')
  assert(sprintProducts[0].tier === 'Test', 'zero-sales must land in Test via tierEngine')
  assert(sprintProducts[0].isFavorite !== true, 'standard sample is not favorite')
  assert(
    sprintProducts[0].commission === 0 && sprintProducts[0].itemsSold === 0,
    'metrics stay zero',
  )

  const slots = testSlotsForProduct(sprintProducts[0])
  assert(slots === TIER_REVIEW_VIDEO_COUNT, 'fresh Test should need 6 trial slots')

  const schedule = buildFilmingSchedule(sprintProducts, sprintConfig, [], new Set())
  const placed = countProductVideos(schedule, sprintProducts[0].id)
  assert(
    placed === TIER_REVIEW_VIDEO_COUNT,
    `expected ${TIER_REVIEW_VIDEO_COUNT} trial videos, got ${placed}`,
  )

  // Not the old 1-slot sample behavior.
  assert(placed !== 1, 'must not use old 1-slot-per-sprint sample allocator')
  console.log('PASS')
}

function runFavoriteSoftPriority(): void {
  console.log('\n=== Favorite is soft trial priority, never a fake tier ===')
  resetStore()

  // 7 incomplete Tests: 1 favorite with 0 commission, 6 with higher commission.
  // Cap is 6 — favorite must be selected even with lowest commission.
  const fixedSamples: SampleProduct[] = [
    mockSample('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Priority Fav', true),
    mockSample('b1111111-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Seller 1', false),
    mockSample('b2222222-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Seller 2', false),
    mockSample('b3333333-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'Seller 3', false),
    mockSample('b4444444-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'Seller 4', false),
    mockSample('b5555555-bbbb-4bbb-8bbb-bbbbbbbbbbb5', 'Seller 5', false),
    mockSample('b6666666-bbbb-4bbb-8bbb-bbbbbbbbbbb6', 'Seller 6', false),
  ]
  upsertCatalogFromSampleProducts(fixedSamples)

  // Give non-favorites fake commission in catalog so commission sort would prefer them.
  const catalog = loadProductCatalog().map((product) =>
    product.isFavorite
      ? product
      : { ...product, commission: 50, itemsSold: 1 },
  )
  saveProductCatalog(catalog)

  const sprintProducts = buildSprintProductsFromCatalog()
  for (const product of sprintProducts) {
    assert(product.tier === 'Test', `${product.productName} must stay Test (itemsSold ≤ 2)`)
    assert(
      product.tier !== 'Rising' && product.tier !== 'Anchor',
      'favorite must never force Rising/Anchor without real sales',
    )
  }

  const favorite = sprintProducts.find((p) => p.isFavorite)
  assert(Boolean(favorite), 'favorite flag should carry onto MergedProduct')
  assert(favorite!.tier === 'Test', 'favorite stays Test')

  const selected = selectActiveTrialProducts(sprintProducts)
  assert(selected.length === 6, 'trial cap remains 6')
  assert(
    selected.some((p) => p.id === favorite!.id),
    'favorite must be in the active trial set despite lowest commission',
  )
  assert(
    selected[0].id === favorite!.id,
    'favorite should sort first in trial priority',
  )

  // sampleProductsToMerged also must not force Rising.
  const merged = sampleProductsToMerged([
    mockSample('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Legacy Fav', true),
  ])
  assert(merged[0].tier === 'Test', 'sampleProductsToMerged favorite stays Test')
  assert(merged[0].isFavorite === true, 'sampleProductsToMerged sets isFavorite')
  console.log('PASS')
}

function runReappearAfterReset(): void {
  console.log('\n=== Catalog products reappear in sprint after Start Over ===')
  resetStore()

  upsertCatalogFromSampleProducts([
    mockSample('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Keep After Reset'),
    mockSample('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Priority Keep', true),
  ])
  const firstSprint = buildSprintProductsFromCatalog()
  assert(firstSprint.length === 2, 'initial sprint from catalog has 2 products')

  const sprint: CurrentSprintState = {
    stage: 'schedule',
    scheduleMode: 'full',
    fileName: null,
    sprintConfig,
    products: firstSprint,
    deadlineProducts: [],
    excludedProductKeys: [],
    sampleProducts: [],
    schedule: buildFilmingSchedule(firstSprint, sprintConfig, [], new Set()),
    filmingProgress: {},
  }
  updateCurrentSprintState(sprint)
  assert(getUserDataSnapshot().currentSprintState !== null, 'sprint state set')

  // Simulate resetSprintState: clear sprint workspace only.
  updateCurrentSprintState(null)
  assert(getUserDataSnapshot().currentSprintState === null, 'sprint cleared')
  assert(loadProductCatalog().length === 2, 'catalog survives reset')

  // New sprint rebuilds from catalog — visible reappear.
  const nextSprint = buildSprintProductsFromCatalog()
  assert(nextSprint.length === 2, 'products reappear from catalog after reset')
  assert(
    nextSprint.every((p) => p.tier === 'Test'),
    'reappeared products still Test',
  )
  const nextSchedule = buildFilmingSchedule(nextSprint, sprintConfig, [], new Set())
  const totalSlots = nextSchedule.reduce((sum, day) => sum + day.videos.length, 0)
  assert(totalSlots >= 6, 'reappeared products get trial slots again')
  console.log('PASS')
}

function runAlreadyTestedCatalogId(): void {
  console.log('\n=== Already-tested keyed by durable catalog UUID ===')
  resetStore()

  const id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  upsertCatalogFromSampleProducts([mockSample(id, 'Pretested Oil')])
  const [product] = buildSprintProductsFromCatalog()
  assert(product.id === id, 'sprint product id is catalog id')
  assert(trialStorageKey(product) === id, 'trial key prefers catalog UUID')
  assert(trialStorageKey(product) !== 'sample', 'must not use sample sentinel')

  markProductAlreadyTested(product)
  const store = getUserDataSnapshot().trialProgress
  assert(store[id]?.videosFilmed === TIER_REVIEW_VIDEO_COUNT, 'progress stored under catalog id')
  assert(store[id]?.source === 'manual', 'already-tested uses manual source')

  const hydrated = hydrateProductsTrialProgress(
    buildSprintProductsFromCatalog(loadProductCatalog(), { hydrateTrial: false }),
    store,
    { persist: false },
  )
  assert(hydrated[0].videosFilmed >= TIER_REVIEW_VIDEO_COUNT, 'hydrate restores already-tested')
  assert(testSlotsForProduct(hydrated[0]) === 0, 'already-tested reserves no trial slots')

  const selected = selectActiveTrialProducts(hydrated)
  assert(!selected.some((p) => p.id === id), 'already-tested excluded from active trials')
  console.log('PASS')
}

function runMergedDraftThroughTierEngine(): void {
  console.log('\n=== Catalog draft → tierEngine zero-sales → Test ===')
  resetStore()
  upsertCatalogFromSampleProducts([
    mockSample('99999999-9999-4999-8999-999999999999', 'Draft Check', true),
  ])
  const draft = mergedDraftFromCatalog(loadProductCatalog()[0])
  assert(draft.isFavorite === true, 'draft carries favorite')
  assert(draft.isManual === false, 'draft forces auto-tier path')
  const [tiered] = tierProducts([draft])
  assert(tiered.tier === 'Test', 'tierEngine assigns Test for zero sales')
  console.log('PASS')
}

function runScheduleFilmingAdvancesDurableTrial(): void {
  console.log('\n=== Schedule filming (+/-) advances durable trial_progress ===')
  resetStore()

  const id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
  upsertCatalogFromSampleProducts([mockSample(id, 'Cumulative Serum')])
  let sprintProducts = buildSprintProductsFromCatalog()
  assert(sprintProducts[0].videosFilmed === 0, 'starts at 0 filmed')

  const firstSchedule = buildFilmingSchedule(sprintProducts, sprintConfig, [], new Set())
  const firstPlaced = countProductVideos(firstSchedule, id)
  assert(firstPlaced === TIER_REVIEW_VIDEO_COUNT, 'fresh product gets 6 slots (not 1)')

  // Simulate checking off 3 schedule slots → durable trial_progress.
  for (let i = 0; i < 3; i++) {
    sprintProducts = persistScheduleFilmedDelta(sprintProducts, id, 1)
  }
  assert(sprintProducts[0].videosFilmed === 3, 'in-memory filmed is 3')
  assert(
    getUserDataSnapshot().trialProgress[id]?.videosFilmed === 3,
    'trial_progress persisted at 3',
  )

  // Simulate Start Over: clear sprint, keep trial_progress + catalog.
  updateCurrentSprintState(null)
  assert(loadProductCatalog().length === 1, 'catalog survives')
  assert(getUserDataSnapshot().trialProgress[id]?.videosFilmed === 3, 'trial survives reset')

  const nextSprint = buildSprintProductsFromCatalog()
  assert(nextSprint[0].videosFilmed === 3, 'hydrate restores cumulative filmed')
  assert(
    testSlotsForProduct(nextSprint[0]) === 3,
    'next sprint asks for remaining 3, not a fresh 6',
  )

  const nextSchedule = buildFilmingSchedule(nextSprint, sprintConfig, [], new Set())
  const nextPlaced = countProductVideos(nextSchedule, id)
  assert(nextPlaced === 3, `next sprint places remaining 3, got ${nextPlaced}`)
  console.log('PASS')
}

function runFirstVideoDeadlineOnTrial(): void {
  console.log('\n=== Optional first-video deadline stays on 6-video Test trial ===')
  resetStore()

  const id = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'
  upsertCatalogFromSampleProducts([
    mockSample(id, 'Deadline Serum', false, '2026-07-25'),
  ])
  const products = buildSprintProductsFromCatalog()
  assert(products[0].firstVideoDeadline === '2026-07-25', 'catalog carries first-video deadline')
  assert(products[0].tier === 'Test', 'still Test tier')

  const schedule = buildFilmingSchedule(products, sprintConfig, [], new Set())
  const slots = schedule.flatMap((day) => day.videos).filter((v) => v.productKey === id)
  assert(slots.length === TIER_REVIEW_VIDEO_COUNT, `expected 6 trial slots, got ${slots.length}`)

  const withDeadline = slots.filter((v) => v.deadlineDate === '2026-07-25')
  assert(withDeadline.length === 1, `exactly one slot carries the deadline, got ${withDeadline.length}`)
  assert(
    !slots.some((v) => v.productKey.startsWith('deadline:')),
    'must use catalog product key, not deadline: prefix',
  )

  // After first video filmed, deadline priority slot goes away; remaining stay Test.
  const afterFirst = persistScheduleFilmedDelta(products, id, 1)
  const nextSchedule = buildFilmingSchedule(afterFirst, sprintConfig, [], new Set())
  const nextSlots = nextSchedule.flatMap((day) => day.videos).filter((v) => v.productKey === id)
  assert(nextSlots.length === 5, `remaining trial is 5, got ${nextSlots.length}`)
  assert(
    nextSlots.every((v) => v.deadlineDate == null),
    'no deadline once first video is filmed',
  )
  console.log('PASS')
}

function runStage2NeverOneSlotFreshProduct(): void {
  console.log('\n=== Stage 2 full path: fresh product is never 1-slot on 7-day sprint ===')
  resetStore()
  upsertCatalogFromSampleProducts([
    mockSample('c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2', 'Six Slot Check'),
  ])
  const products = buildSprintProductsFromCatalog()
  const schedule = buildFilmingSchedule(products, sprintConfig, [], new Set())
  const placed = countProductVideos(schedule, products[0].id)
  assert(placed === 6, `expected 6 trial videos, got ${placed}`)
  assert(placed !== 1, 'must not use old sample 1-slot allocator')
  console.log('PASS')
}

try {
  runZeroSalesFullTrial()
  runFavoriteSoftPriority()
  runReappearAfterReset()
  runAlreadyTestedCatalogId()
  runMergedDraftThroughTierEngine()
  runScheduleFilmingAdvancesDurableTrial()
  runFirstVideoDeadlineOnTrial()
  runStage2NeverOneSlotFreshProduct()
  console.log('\nAll Stage 2 catalog schedule checks passed.')
} catch (error) {
  console.error('\nVERIFICATION FAILED:', error)
  process.exit(1)
}

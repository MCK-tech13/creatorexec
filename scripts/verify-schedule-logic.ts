/**
 * Run: npx tsx scripts/verify-schedule-logic.ts
 */
import type { MergedProduct, SprintConfig } from '../src/types'
import { buildFilmingSchedule } from '../src/lib/schedule/scheduleBuilder'
import { buildMomentumModeSchedule } from '../src/lib/schedule/momentumModeSchedule'
import {
  TEST_VIDEO_GUARANTEE,
  computeProductSlotAllocations,
  isLowAnchorAccount,
  MAX_TEST_VIDEOS_PER_DAY,
  MIN_TEST_SPREAD_DAYS,
} from '../src/lib/schedule/slotAllocation'
import {
  hydrateProductTrialProgress,
  MAX_ACTIVE_TRIAL_PRODUCTS_PER_SPRINT,
  remainingTrialSlots,
  summarizeTrialScheduling,
} from '../src/lib/schedule/trialProgress'
import type { TrialProgressStore } from '../src/lib/schedule/trialProgressStorage'

function mockProduct(
  id: string,
  name: string,
  tier: MergedProduct['tier'],
  commission: number,
  videosFilmed = 0,
): MergedProduct {
  return {
    id,
    productName: name,
    productId: `pid-${id}`,
    gmv: commission * 10,
    commission,
    itemsSold: Math.round(commission / 5),
    orderCount: 1,
    videosFilmed,
    score: commission,
    tier,
    rankInTier: 1,
    inRotation: true,
    isManual: false,
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function countTierVideos(
  schedule: ReturnType<typeof buildFilmingSchedule>,
  productId: string,
): number {
  return schedule.reduce(
    (sum, day) => sum + day.videos.filter((v) => v.productKey === productId).length,
    0,
  )
}

function testProductDays(
  schedule: ReturnType<typeof buildFilmingSchedule>,
  productId: string,
): number {
  return schedule.filter((day) =>
    day.videos.some((v) => v.productKey === productId),
  ).length
}

function maxPerDay(
  schedule: ReturnType<typeof buildFilmingSchedule>,
  productId: string,
): number {
  return Math.max(
    0,
    ...schedule.map((day) => day.videos.filter((v) => v.productKey === productId).length),
  )
}

function top3AppearDaily(
  schedule: ReturnType<typeof buildFilmingSchedule>,
  ids: string[],
  sprintDays: number,
): boolean {
  for (let day = 0; day < sprintDays; day++) {
    for (const id of ids) {
      const count = schedule[day].videos.filter((v) => v.productKey === id).length
      if (count < 1) return false
    }
  }
  return true
}

function runHighVolumeTest(): void {
  console.log('\n=== High-volume account (5 Anchors, 6 Rising, 4 Test) ===')
  const config: SprintConfig = { videosPerDay: 8, sprintDays: 7 }
  const anchors = [
    mockProduct('a1', 'Anchor Top 1', 'Anchor', 500),
    mockProduct('a2', 'Anchor Top 2', 'Anchor', 400),
    mockProduct('a3', 'Anchor Top 3', 'Anchor', 300),
    mockProduct('a4', 'Anchor 4', 'Anchor', 200),
    mockProduct('a5', 'Anchor 5', 'Anchor', 150),
  ]
  const rising = Array.from({ length: 6 }, (_, i) =>
    mockProduct(`r${i}`, `Rising ${i + 1}`, 'Rising', 80 - i * 5),
  )
  const tests = Array.from({ length: 4 }, (_, i) =>
    mockProduct(`t${i}`, `Test ${i + 1}`, 'Test', 20 - i),
  )
  const products = [...anchors, ...rising, ...tests]

  assert(!isLowAnchorAccount(anchors.length), 'Should not be low-anchor mode')

  const allocations = computeProductSlotAllocations(
    anchors,
    rising,
    tests,
    config.videosPerDay * config.sprintDays,
    0,
    config.sprintDays,
  )

  for (const test of tests) {
    const row = allocations.find((a) => a.product.id === test.id)
    assert(
      row?.slots === remainingTrialSlots(test.videosFilmed),
      `${test.productName} should get ${remainingTrialSlots(test.videosFilmed)} slots`,
    )
  }

  const top3Alloc = allocations.filter((a) => ['a1', 'a2', 'a3'].includes(a.product.id))
  for (const row of top3Alloc) {
    assert(row.slots >= config.sprintDays, `Top anchor ${row.product.productName} should target daily`)
  }

  const schedule = buildFilmingSchedule(products, config)

  for (const test of tests) {
    const placed = countTierVideos(schedule, test.id)
    const expected = remainingTrialSlots(test.videosFilmed)
    assert(placed === expected, `${test.productName} should place ${expected} videos`)
    assert(
      testProductDays(schedule, test.id) >= MIN_TEST_SPREAD_DAYS,
      `${test.productName} should spread across ≥${MIN_TEST_SPREAD_DAYS} days`,
    )
    assert(
      maxPerDay(schedule, test.id) <= MAX_TEST_VIDEOS_PER_DAY,
      `${test.productName} should have ≤${MAX_TEST_VIDEOS_PER_DAY}/day`,
    )
  }

  assert(
    top3AppearDaily(schedule, ['a1', 'a2', 'a3'], config.sprintDays),
    'Top 3 anchors should appear every day',
  )

  console.log('Allocations:', allocations.map((a) => `${a.product.productName}: ${a.slots}`).join(', '))
  console.log(
    'Daily totals:',
    schedule.map((d) => `Day ${d.day}: ${d.videos.length}`).join(' | '),
  )
  console.log('PASS')
}

function runLowVolumeTest(): void {
  console.log('\n=== Low-volume account (1 Anchor, 2 Rising, 5 Test) ===')
  const config: SprintConfig = { videosPerDay: 6, sprintDays: 7 }
  const anchors = [mockProduct('a1', 'Only Anchor', 'Anchor', 120)]
  const rising = [
    mockProduct('r1', 'Rising 1', 'Rising', 60),
    mockProduct('r2', 'Rising 2', 'Rising', 40),
  ]
  const tests = Array.from({ length: 5 }, (_, i) =>
    mockProduct(`t${i}`, `Test ${i + 1}`, 'Test', 15 - i),
  )
  const products = [...anchors, ...rising, ...tests]

  assert(isLowAnchorAccount(anchors.length), 'Should be low-anchor mode')

  const allocations = computeProductSlotAllocations(
    anchors,
    rising,
    tests,
    config.videosPerDay * config.sprintDays,
    0,
    config.sprintDays,
  )

  for (const test of tests) {
    const row = allocations.find((a) => a.product.id === test.id)
    assert(
      row?.slots === remainingTrialSlots(test.videosFilmed),
      `${test.productName} must keep ${remainingTrialSlots(test.videosFilmed)}-slot guarantee`,
    )
  }

  const topAnchorDaily = countTierVideos(
    buildFilmingSchedule(products, config),
    'a1',
  )
  assert(topAnchorDaily < config.sprintDays, 'Single anchor should not be forced daily')

  const schedule = buildFilmingSchedule(products, config)
  const testPlaced = tests.reduce((sum, t) => sum + countTierVideos(schedule, t.id), 0)
  const testExpected = tests.reduce((sum, t) => sum + remainingTrialSlots(t.videosFilmed), 0)
  assert(testPlaced === testExpected, 'All test guarantees should place')

  console.log('Allocations:', allocations.map((a) => `${a.product.productName}: ${a.slots}`).join(', '))
  console.log(`Only Anchor placed ${topAnchorDaily}× (not ${config.sprintDays} daily)`)
  console.log(`Test videos placed: ${testPlaced}/${testExpected}`)
  console.log('PASS')
}

function runMomentumTest(): void {
  console.log('\n=== Momentum mode (0 Anchors, 3 Rising, 4 Test) ===')
  const config: SprintConfig = { videosPerDay: 5, sprintDays: 7 }
  const rising = Array.from({ length: 3 }, (_, i) =>
    mockProduct(`r${i}`, `Rising ${i + 1}`, 'Rising', 50 - i * 10),
  )
  const tests = Array.from({ length: 4 }, (_, i) =>
    mockProduct(`t${i}`, `Test ${i + 1}`, 'Test', 12 - i),
  )

  const schedule = buildMomentumModeSchedule([...rising, ...tests], config)

  for (const test of tests) {
    const expected = remainingTrialSlots(test.videosFilmed)
    assert(
      countTierVideos(schedule, test.id) === expected,
      `Momentum ${test.productName} should place ${expected} videos`,
    )
  }

  console.log(
    'Daily totals:',
    schedule.map((d) => `Day ${d.day}: ${d.videos.length}`).join(' | '),
  )
  console.log('PASS')
}

function runSalesHistoryHydrationTest(): void {
  console.log('\n=== Sales history auto-completes trial on first hydration ===')
  const store: TrialProgressStore = {}
  const provenSeller = mockProduct('s1', 'Proven seller', 'Rising', 80)
  const testWithSales = mockProduct('s2', 'Test with sales', 'Test', 12)

  const hydratedProven = hydrateProductTrialProgress(provenSeller, store, { persist: false })
  assert(hydratedProven.videosFilmed === 6, 'Non-Test product with commission should start trial-complete')

  const hydratedTest = hydrateProductTrialProgress(testWithSales, store, { persist: false })
  assert(
    hydratedTest.videosFilmed === 0,
    'Test-tier product with commission should still start at 0',
  )

  const legacyStore: TrialProgressStore = { 'pid-s2': { videosFilmed: 6 } }
  const legacyTest = hydrateProductTrialProgress(testWithSales, legacyStore, { persist: false })
  assert(
    legacyTest.videosFilmed === 0,
    'Legacy Test-tier auto-complete at 6 should be cleared on hydration',
  )

  const manualStore: TrialProgressStore = {
    'pid-s2': { videosFilmed: 6, source: 'manual' },
  }
  const manualComplete = hydrateProductTrialProgress(testWithSales, manualStore, {
    persist: false,
  })
  assert(
    manualComplete.videosFilmed === 6,
    'Manually completed Test-tier trials should be preserved',
  )

  const rehydrateStore: TrialProgressStore = {
    'pid-s1': { videosFilmed: 2, source: 'manual' },
  }
  const rehydrated = hydrateProductTrialProgress(provenSeller, rehydrateStore, { persist: false })
  assert(
    rehydrated.videosFilmed === 2,
    'Existing stored trial progress must not be overwritten',
  )

  const fresh = mockProduct('f1', 'Fresh test', 'Test', 0)
  const hydratedFresh = hydrateProductTrialProgress(fresh, {}, { persist: false })
  assert(hydratedFresh.videosFilmed === 0, 'Zero-commission product should still start at 0')

  console.log('PASS')
}

function runLargeTestQueueSchedulingTest(): void {
  console.log('\n=== Large Test queue (31 products, mixed trial state) ===')
  const config: SprintConfig = { videosPerDay: 8, sprintDays: 7 }
  const anchors = [
    mockProduct('a1', 'Anchor 1', 'Anchor', 500),
    mockProduct('a2', 'Anchor 2', 'Anchor', 400),
    mockProduct('a3', 'Anchor 3', 'Anchor', 300),
  ]

  const tests = [
    ...Array.from({ length: 10 }, (_, i) =>
      mockProduct(`tc${i}`, `Complete ${i + 1}`, 'Test', 30 - i, 6),
    ),
    ...Array.from({ length: 21 }, (_, i) =>
      mockProduct(`ti${i}`, `Incomplete ${i + 1}`, 'Test', 25 - i, 0),
    ),
  ]
  const products = [...anchors, ...tests]

  const summary = summarizeTrialScheduling(products)
  assert(summary.totalTestTier === 31, 'Should have 31 Test-tier products')
  assert(summary.incompleteTrials === 21, '21 incomplete trials should be eligible')
  assert(summary.trialComplete === 10, '10 should already be trial-complete')
  assert(summary.cappedForSprint === MAX_ACTIVE_TRIAL_PRODUCTS_PER_SPRINT, 'Cap should select 6')

  const schedule = buildFilmingSchedule(products, config)
  const testVideos = schedule.reduce(
    (sum, day) => sum + day.videos.filter((video) => video.tier === 'Test').length,
    0,
  )
  assert(testVideos > 0, 'Schedule should include Test videos when incomplete trials exist')
  assert(testVideos === 6 * MAX_ACTIVE_TRIAL_PRODUCTS_PER_SPRINT, 'Top 6 should each place 6 videos')

  const incompleteIds = new Set(
    tests.filter((product) => product.videosFilmed < 6).map((product) => product.id),
  )
  const scheduledTestIds = new Set(
    schedule.flatMap((day) =>
      day.videos.filter((video) => video.tier === 'Test').map((video) => video.productKey),
    ),
  )
  for (const id of scheduledTestIds) {
    assert(incompleteIds.has(id), `Scheduled test ${id} should be incomplete`)
  }

  console.info('[CreatorExec] Trial scheduling summary', summary)
  console.log(`Test videos placed: ${testVideos}`)
  console.log('PASS')
}

function runTrialCapTest(): void {
  console.log('\n=== Trial slot cap (only top N Test products per sprint) ===')
  const config: SprintConfig = { videosPerDay: 8, sprintDays: 7 }
  const anchors = [
    mockProduct('a1', 'Anchor 1', 'Anchor', 500),
    mockProduct('a2', 'Anchor 2', 'Anchor', 400),
    mockProduct('a3', 'Anchor 3', 'Anchor', 300),
  ]
  const tests = Array.from({ length: 10 }, (_, i) =>
    mockProduct(`t${i}`, `Test ${i + 1}`, 'Test', 50 - i),
  )

  const allocations = computeProductSlotAllocations(
    anchors,
    [],
    tests,
    config.videosPerDay * config.sprintDays,
    0,
    config.sprintDays,
  )

  const testAllocations = allocations.filter((a) => a.tier === 'Test')
  assert(
    testAllocations.length === MAX_ACTIVE_TRIAL_PRODUCTS_PER_SPRINT,
    `Only top ${MAX_ACTIVE_TRIAL_PRODUCTS_PER_SPRINT} tests should reserve trial slots`,
  )

  for (let i = 0; i < MAX_ACTIVE_TRIAL_PRODUCTS_PER_SPRINT; i++) {
    const row = allocations.find((a) => a.product.id === `t${i}`)
    assert(row?.slots === TEST_VIDEO_GUARANTEE, `Top test t${i} should still get 6 slots`)
  }

  for (let i = MAX_ACTIVE_TRIAL_PRODUCTS_PER_SPRINT; i < tests.length; i++) {
    const row = allocations.find((a) => a.product.id === `t${i}`)
    assert(row === undefined, `Lower-priority test t${i} should not reserve trial slots`)
  }

  const anchorSlots = allocations
    .filter((a) => a.tier === 'Anchor')
    .reduce((sum, a) => sum + a.slots, 0)
  assert(anchorSlots > 0, 'Trial cap should leave room for anchor scheduling')

  console.log(
    'Test allocations:',
    testAllocations.map((a) => `${a.product.productName}: ${a.slots}`).join(', '),
  )
  console.log('PASS')
}

function runPartialTrialTest(): void {
  console.log('\n=== Partial trial progress (4 prior videos → schedule 2) ===')
  const config: SprintConfig = { videosPerDay: 5, sprintDays: 7 }
  const anchors = [
    mockProduct('a1', 'Anchor 1', 'Anchor', 300),
    mockProduct('a2', 'Anchor 2', 'Anchor', 200),
    mockProduct('a3', 'Anchor 3', 'Anchor', 150),
  ]
  const tests = [
    mockProduct('t1', 'Test partial', 'Test', 25, 4),
    mockProduct('t2', 'Test fresh', 'Test', 20, 0),
    mockProduct('t3', 'Test complete', 'Test', 15, 6),
  ]
  const products = [...anchors, ...tests]

  const allocations = computeProductSlotAllocations(
    anchors,
    [],
    tests.filter((t) => t.id !== 't3'),
    config.videosPerDay * config.sprintDays,
    0,
    config.sprintDays,
  )

  const partial = allocations.find((a) => a.product.id === 't1')
  const fresh = allocations.find((a) => a.product.id === 't2')
  const complete = allocations.find((a) => a.product.id === 't3')

  assert(partial?.slots === 2, 'Partial trial should schedule 2 remaining videos')
  assert(fresh?.slots === TEST_VIDEO_GUARANTEE, 'Fresh test should schedule 6 videos')
  assert(complete === undefined, 'Trial-complete product should not be allocated')

  const schedule = buildFilmingSchedule(products, config)
  assert(countTierVideos(schedule, 't1') === 2, 'Partial trial should place 2 videos')
  assert(countTierVideos(schedule, 't2') === 6, 'Fresh test should place 6 videos')
  assert(countTierVideos(schedule, 't3') === 0, 'Trial-complete test should not auto-schedule')

  console.log('Allocations:', allocations.map((a) => `${a.product.productName}: ${a.slots}`).join(', '))
  console.log('PASS')
}

try {
  runHighVolumeTest()
  runLowVolumeTest()
  runMomentumTest()
  runPartialTrialTest()
  runSalesHistoryHydrationTest()
  runTrialCapTest()
  runLargeTestQueueSchedulingTest()
  console.log('\nAll schedule verification checks passed.')
} catch (error) {
  console.error('\nVERIFICATION FAILED:', error)
  process.exit(1)
}

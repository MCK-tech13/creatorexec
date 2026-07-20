/**
 * Diagnosis: uneven daily video counts with videosPerDay=15.
 * Run: npx tsx scripts/repro-uneven-daily-counts.ts
 */
import type { MergedProduct, ScheduledVideo, SprintConfig } from '../src/types'
import { AngleRotationSession } from '../src/lib/schedule/angleRotation'
import { buildFilmingSchedule } from '../src/lib/schedule/scheduleBuilder'
import { collapseDayVideos } from '../src/lib/schedule/collapseDayVideos'
import {
  buildFirstVideoDeadlineVideos,
  decrementRemainingForFirstVideoDeadlines,
  fillDailyCapacity,
  placeProvenProductsRoundRobin,
  placeRemainingByTier,
  placeRetainerVideos,
  placeTestProductsWithSpread,
  placeTopAnchorsDaily,
  type DailyFillProduct,
  type SlotPlacementRow,
} from '../src/lib/schedule/schedulePlacement'
import {
  computeProductSlotAllocations,
  isLowAnchorAccount,
  selectProvenTierProducts,
  type ProductSlotAllocation,
} from '../src/lib/schedule/slotAllocation'
import { createPlacementReasonBuilder, buildProvenSlotsMap } from '../src/lib/schedule/placementReasons'

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

function mockProduct(
  id: string,
  name: string,
  tier: MergedProduct['tier'],
  commission: number,
  opts?: { videosFilmed?: number; firstVideoDeadline?: string | null; isFavorite?: boolean },
): MergedProduct {
  return {
    id,
    productName: name,
    productId: `pid-${id}`,
    gmv: commission * 10,
    commission,
    itemsSold: tier === 'Test' ? 0 : Math.max(1, Math.round(commission / 5)),
    orderCount: tier === 'Test' ? 0 : 1,
    videosFilmed: opts?.videosFilmed ?? 0,
    score: commission,
    tier,
    rankInTier: 1,
    inRotation: true,
    isManual: tier === 'Test',
    isFavorite: opts?.isFavorite,
    firstVideoDeadline: opts?.firstVideoDeadline ?? null,
  }
}

function dayCounts(schedule: { day: number; videos: ScheduledVideo[] }[]): number[] {
  return schedule.map((d) => d.videos.length)
}

function printSchedule(label: string, schedule: ReturnType<typeof buildFilmingSchedule>, cap: number) {
  const counts = dayCounts(schedule)
  const total = counts.reduce((a, b) => a + b, 0)
  const collapsedCounts = schedule.map((d) => {
    const rows = collapseDayVideos(d.day, d.videos)
    return {
      day: d.day,
      slots: d.videos.length,
      collapsedRows: rows.length,
      collapsedTotalSum: rows.reduce((s, r) => s + r.total, 0),
    }
  })
  console.log(`\n=== ${label} ===`)
  console.log(`cap=${cap} | day counts: [${counts.join(', ')}] | total=${total}`)
  console.log(
    'min/max/avg:',
    Math.min(...counts),
    Math.max(...counts),
    (total / counts.length).toFixed(1),
  )
  console.log(
    'over-cap days:',
    counts
      .map((c, i) => ({ day: i + 1, c }))
      .filter((x) => x.c > cap)
      .map((x) => `D${x.day}=${x.c}`)
      .join(', ') || 'none',
  )
  console.log(
    'under-cap days:',
    counts
      .map((c, i) => ({ day: i + 1, c }))
      .filter((x) => x.c < cap)
      .map((x) => `D${x.day}=${x.c}`)
      .join(', ') || 'none',
  )
  console.log(
    'UI collapse check:',
    collapsedCounts.map((r) => `D${r.day}:slots=${r.slots}/rows=${r.collapsedRows}/sum=${r.collapsedTotalSum}`).join(' | '),
  )
  const byTier = schedule.map((d) => {
    const tiers: Record<string, number> = {}
    for (const v of d.videos) tiers[v.tier] = (tiers[v.tier] ?? 0) + 1
    return `D${d.day}:{${Object.entries(tiers).map(([k, v]) => `${k}:${v}`).join(',')}}`
  })
  console.log('by tier:', byTier.join(' | '))
}

function snapshot(perDay: ScheduledVideo[][]): string {
  return perDay.map((d, i) => `D${i + 1}=${d.length}`).join(' ')
}

/** Mirror allocateSchedule with phase logging. */
function allocateWithPhases(
  allocations: ProductSlotAllocation[],
  topAnchorIds: Set<string>,
  provenProductIds: Set<string>,
  firstVideoDeadlineVideos: ScheduledVideo[],
  fillPool: DailyFillProduct[],
  sprintDays: number,
  cap: number,
): void {
  const perDay: ScheduledVideo[][] = Array.from({ length: sprintDays }, () => [])
  const angleSession = new AngleRotationSession()
  const reasonBuilder = createPlacementReasonBuilder({
    mode: 'full',
    topAnchorIds,
    provenSlotsByProduct: buildProvenSlotsMap(allocations),
    sprintDays,
  })

  placeRetainerVideos(perDay, [], cap)
  console.log('  after retainer/deadlines(none):', snapshot(perDay))

  // emulate placeDeadlineVideos for first-video
  let cursor = 0
  for (const video of firstVideoDeadlineVideos) {
    let placed = false
    for (let attempt = 0; attempt < sprintDays; attempt++) {
      const day = (cursor + attempt) % sprintDays
      if (perDay[day].length < cap) {
        perDay[day].push(video)
        cursor = (day + 1) % sprintDays
        placed = true
        break
      }
    }
    if (!placed) break
  }
  console.log(
    `  after firstVideoDeadlines (${firstVideoDeadlineVideos.length}):`,
    snapshot(perDay),
  )

  const rows: SlotPlacementRow[] = allocations.map((row) => ({
    product: row.product,
    tier: row.tier,
    remaining: row.slots,
  }))
  decrementRemainingForFirstVideoDeadlines(
    rows,
    new Set(firstVideoDeadlineVideos.map((v) => v.productKey)),
  )
  console.log(
    '  remaining after deadline decrement:',
    rows.map((r) => `${r.product.productName}:${r.remaining}`).join(', '),
  )

  placeTopAnchorsDaily(perDay, topAnchorIds, rows, cap, sprintDays, angleSession, reasonBuilder)
  console.log('  after placeTopAnchorsDaily:', snapshot(perDay))

  placeTestProductsWithSpread(perDay, rows, cap, sprintDays, angleSession, reasonBuilder)
  console.log('  after placeTestProductsWithSpread:', snapshot(perDay))
  console.log(
    '  test remaining:',
    rows.filter((r) => r.tier === 'Test').map((r) => `${r.product.productName}:${r.remaining}`).join(', '),
  )

  placeProvenProductsRoundRobin(perDay, rows, cap, provenProductIds, angleSession, reasonBuilder)
  console.log('  after placeProvenProductsRoundRobin:', snapshot(perDay))

  placeRemainingByTier(perDay, rows, cap, ['Test', 'Rising', 'Anchor'], angleSession, reasonBuilder)
  console.log('  after placeRemainingByTier:', snapshot(perDay))

  const maxSprintByProduct = new Map(allocations.map((row) => [row.product.id, row.slots]))
  for (const entry of fillPool) {
    if (maxSprintByProduct.has(entry.product.id)) continue
    if (entry.tier === 'Rising' || entry.tier === 'Anchor') {
      maxSprintByProduct.set(entry.product.id, sprintDays)
    }
  }
  fillDailyCapacity(
    perDay,
    rows,
    fillPool,
    cap,
    sprintDays,
    maxSprintByProduct,
    angleSession,
    reasonBuilder,
  )
  console.log('  after fillDailyCapacity:', snapshot(perDay))
}

function runScenario(
  label: string,
  products: MergedProduct[],
  config: SprintConfig,
  withPhases = false,
) {
  const schedule = buildFilmingSchedule(products, config)
  printSchedule(label, schedule, config.videosPerDay)

  if (!withPhases) return

  const scheduleProducts = products.filter((p) => p.tier !== 'Cut' && p.inRotation)
  const anchors = scheduleProducts
    .filter((p) => p.tier === 'Anchor')
    .sort((a, b) => b.commission - a.commission)
  const rising = scheduleProducts
    .filter((p) => p.tier === 'Rising')
    .sort((a, b) => b.commission - a.commission)
  const tests = scheduleProducts
    .filter((p) => p.tier === 'Test')
    .sort((a, b) => b.commission - a.commission)

  const lowAnchorMode = isLowAnchorAccount(anchors.length)
  const topAnchorIds = lowAnchorMode
    ? new Set<string>()
    : new Set(anchors.slice(0, 3).map((p) => p.id))
  const provenProducts = selectProvenTierProducts(anchors, rising, lowAnchorMode)
  const provenProductIds = new Set(provenProducts.map((p) => p.id))
  const cap = Math.max(1, config.videosPerDay)
  const totalSlots = cap * config.sprintDays
  const allocations = computeProductSlotAllocations(
    anchors,
    rising,
    tests,
    totalSlots,
    0,
    config.sprintDays,
  )
  console.log(
    '  allocations:',
    allocations.map((a) => `${a.product.productName}(${a.tier})=${a.slots}`).join(', '),
    `| sum=${allocations.reduce((s, a) => s + a.slots, 0)} / totalSlots=${totalSlots}`,
  )
  const firstVideoDeadlineVideos = buildFirstVideoDeadlineVideos(tests)
  const fillPool: DailyFillProduct[] = [
    ...tests.map((product) => ({ product, tier: 'Test' as const })),
    ...rising.map((product) => ({ product, tier: 'Rising' as const })),
    ...anchors.map((product) => ({ product, tier: 'Anchor' as const })),
  ]
  console.log('  --- placement phases ---')
  allocateWithPhases(
    allocations,
    topAnchorIds,
    provenProductIds,
    firstVideoDeadlineVideos,
    fillPool,
    config.sprintDays,
    cap,
  )
}

const config15: SprintConfig = { videosPerDay: 15, sprintDays: 7 }

// Scenario A: ~6–8 products, mostly Test + 1–2 Rising (catalog-like no-sales adds)
runScenario(
  'A: 6 Test (0 sales) + 2 Rising, videosPerDay=15',
  [
    mockProduct('t1', 'Test A', 'Test', 0),
    mockProduct('t2', 'Test B', 'Test', 0),
    mockProduct('t3', 'Test C', 'Test', 0),
    mockProduct('t4', 'Test D', 'Test', 0),
    mockProduct('t5', 'Test E', 'Test', 0),
    mockProduct('t6', 'Test F', 'Test', 0),
    mockProduct('r1', 'Rising 1', 'Rising', 80),
    mockProduct('r2', 'Rising 2', 'Rising', 50),
  ],
  config15,
  true,
)

// Scenario B: 10 Test products (catalog flood) — only 6 get trial allocation
runScenario(
  'B: 10 Test products wanting 6 trials each, videosPerDay=15',
  Array.from({ length: 10 }, (_, i) => mockProduct(`t${i}`, `Test ${i + 1}`, 'Test', 0)),
  config15,
  true,
)

// Scenario C: 10 Test with first-video deadlines (Stage 2/3 sample path)
runScenario(
  'C: 8 Test with firstVideoDeadline + 1 Rising',
  [
    ...Array.from({ length: 8 }, (_, i) =>
      mockProduct(`t${i}`, `Sample ${i + 1}`, 'Test', 0, {
        firstVideoDeadline: `2026-08-0${(i % 9) + 1}`,
        isFavorite: i < 2,
      }),
    ),
    mockProduct('r1', 'Rising 1', 'Rising', 60),
  ],
  config15,
  true,
)

// Scenario D: lower capacity (pre-Stage2 typical?) for comparison
runScenario(
  'D: same 6 Test + 2 Rising but videosPerDay=5',
  [
    mockProduct('t1', 'Test A', 'Test', 0),
    mockProduct('t2', 'Test B', 'Test', 0),
    mockProduct('t3', 'Test C', 'Test', 0),
    mockProduct('t4', 'Test D', 'Test', 0),
    mockProduct('t5', 'Test E', 'Test', 0),
    mockProduct('t6', 'Test F', 'Test', 0),
    mockProduct('r1', 'Rising 1', 'Rising', 80),
    mockProduct('r2', 'Rising 2', 'Rising', 50),
  ],
  { videosPerDay: 5, sprintDays: 7 },
  true,
)

// Scenario E: rich catalog with anchors (should fill more evenly via top anchors + fill)
runScenario(
  'E: 3 Anchor + 2 Rising + 6 Test, videosPerDay=15',
  [
    mockProduct('a1', 'Anchor 1', 'Anchor', 200),
    mockProduct('a2', 'Anchor 2', 'Anchor', 180),
    mockProduct('a3', 'Anchor 3', 'Anchor', 160),
    mockProduct('r1', 'Rising 1', 'Rising', 80),
    mockProduct('r2', 'Rising 2', 'Rising', 50),
    ...Array.from({ length: 6 }, (_, i) => mockProduct(`t${i}`, `Test ${i + 1}`, 'Test', 0)),
  ],
  config15,
  true,
)

// Scenario F: only tests, high VPD — worst case clustering
runScenario(
  'F: 6 Test only, videosPerDay=15 (no Rising/Anchor fill fuel)',
  Array.from({ length: 6 }, (_, i) => mockProduct(`t${i}`, `Test ${i + 1}`, 'Test', 0)),
  config15,
  true,
)

console.log('\nDone.')

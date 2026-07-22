/**
 * SOP schedule builder (PR 4a) — urgent priority + sacrifice ladder.
 *
 * Usage: npx tsx scripts/verify-sop-schedule.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCommissionCsv, isParseError } from '../src/lib/csv/parser'
import { tierProductsSop } from '../src/lib/analysis/sopTierAssign'
import { computeSopScaling } from '../src/lib/analysis/sopTierEngine'
import {
  applySopSacrificeLadder,
  buildSopModeScheduleDetailed,
  buildSopSlotDemand,
  SOP_NEW_SAMPLE_MAX_PER_DAY,
  SOP_URGENT_DAY1_MIN_SLOTS,
} from '../src/lib/schedule/sopSchedule'
import { formatScheduleText } from '../src/lib/schedule/scheduleBuilder'
import type { MergedProduct, SprintConfig } from '../src/types'

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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function money(n: number) {
  return `$${n.toFixed(2)}`
}

console.log('='.repeat(72))
console.log('SOP SCHEDULE PR 4a — verification')
console.log('='.repeat(72))

// --- Fixture: sample CSV + fillers so Band/Urgent exist outside Top/Mid ---
const csvText = readFileSync(path.join(root, 'src/data/sample-commission.csv'), 'utf8')
const parsed = parseCommissionCsv(csvText)
if (isParseError(parsed)) throw new Error(parsed.message)

const asOf = new Date('2026-07-20T12:00:00Z')
const config: SprintConfig = { videosPerDay: 10, sprintDays: 3 }

// High earners fill Top/Mid at 10×3 (smaller budget → fewer Top/Mid seats)
const fillers: MergedProduct[] = Array.from({ length: 12 }, (_, i) => ({
  id: `filler-${i}`,
  productName: `TopEarn ${String(i).padStart(2, '0')}`,
  productId: `filler-${i}`,
  gmv: 5000,
  commission: i < 3 ? 300 - i * 40 : 80 - (i - 3),
  itemsSold: 40,
  orderCount: 5,
  videosFilmed: 6,
  score: 0,
  tier: 'Test' as const,
  rankInTier: 0,
  inRotation: true,
  isManual: false,
}))

const csvDrafts = parsed.products.map((p) => ({
  id: p.id,
  productName: p.productName,
  productId: p.productId,
  gmv: p.gmv,
  commission: p.commission,
  itemsSold: p.itemsSold,
  orderCount: p.orderCount,
  videosFilmed: 6,
  inRotation: true,
  isManual: false,
}))

// Real CSV rows forced into Band/Urgent/NewSample by filler Top/Mid
const earbuds = csvDrafts.find((p) => p.productName.includes('Wireless Earbuds'))!
const lamp = csvDrafts.find((p) => p.productName.includes('LED Desk Lamp'))!
const posture = csvDrafts.find((p) => p.productName.includes('Posture Corrector'))!
const serum = csvDrafts.find((p) => p.productName.includes('Vitamin C'))!

const urgentSample = {
  id: 'urgent-sample',
  productName: 'Urgent Deadline Serum',
  productId: 'urgent-1',
  gmv: 20,
  commission: 2,
  itemsSold: 1,
  orderCount: 1,
  videosFilmed: 0,
  inRotation: true,
  isManual: false,
  firstVideoDeadline: '2026-07-22', // ≤4 days from asOf
}

const pool = [
  ...fillers.map(({ score: _s, tier: _t, rankInTier: _r, ...rest }) => rest),
  {
    ...earbuds,
    videosFilmed: 6,
    commission: 24.4,
    itemsSold: 7,
    gmv: 139.93,
  },
  {
    ...lamp,
    videosFilmed: 6,
    commission: 14.11,
    itemsSold: 4,
    gmv: 90,
  },
  {
    ...posture,
    videosFilmed: 6,
    commission: 9.6,
    itemsSold: 6,
    gmv: 60,
  },
  {
    ...serum,
    videosFilmed: 2,
    commission: 4,
    itemsSold: 2,
  },
  urgentSample,
]

const { products: tiered, meta } = tierProductsSop(pool, {
  dailyVolume: config.videosPerDay,
  sprintDays: config.sprintDays,
  asOfDate: asOf,
})

console.log('\nSOP assignment snapshot @ 10×3:')
console.log({
  anchors: meta.anchorCount,
  rotators: meta.rotatorCount,
  mid: meta.midCount,
  bands: {
    A: meta.scaling.bands.sprintBandAThreshold,
    B: meta.scaling.bands.sprintBandBThreshold,
  },
})
console.table(
  tiered
    .filter((p) =>
      ['Urgent', 'BandA', 'BandB', 'Anchor', 'Rotator', 'Mid', 'NewSample', 'Retired'].includes(
        p.sopTier ?? '',
      ),
    )
    .slice(0, 20)
    .map((p) => ({
      product: p.productName.slice(0, 28),
      commission: money(p.commission),
      sopTier: p.sopTier,
      visible: p.tier,
      sopBand: p.sopBand ?? null,
      videos: p.videosFilmed,
    })),
)

const urgent = tiered.find((p) => p.id === 'urgent-sample')
assert.equal(urgent?.sopTier, 'Urgent', 'urgent sample must be Urgent')
assert.equal(
  tiered.find((p) => p.id === earbuds.id)?.sopTier,
  'BandA',
  'earbuds → BandA outside Top/Mid',
)

// --- Demand + sacrifice unit checks ---
{
  const scaling = computeSopScaling({
    dailyVolume: config.videosPerDay,
    sprintDays: config.sprintDays,
  })
  const demand = buildSopSlotDemand(tiered, config.videosPerDay, config.sprintDays, asOf)
  const ideal = demand.reduce((s, d) => s + d.slots, 0)
  console.log('\nIdeal demand vs sprint budget:')
  console.log({
    idealSlots: ideal,
    budget: scaling.slots.totalSlots,
    fillPool: scaling.slots.newSampleFillSlots,
    byKind: Object.fromEntries(
      ['urgent', 'anchor', 'rotator', 'mid', 'bandA', 'bandB', 'newSample'].map((k) => [
        k,
        demand.filter((d) => d.kind === k).reduce((s, d) => s + d.slots, 0),
      ]),
    ),
  })

  // Force sacrifice: budget below flexible demand but above protected floor
  // Protected = urgent(2)+anchor(3)+rotator(4)+bandA(4) = 13
  const protectedSlots = demand
    .filter((d) => ['urgent', 'anchor', 'rotator', 'bandA'].includes(d.kind))
    .reduce((s, d) => s + d.slots, 0)
  const { demand: cut, report } = applySopSacrificeLadder(demand, protectedSlots)
  assert.ok(report.newSampleSlotsCut + report.bandBSlotsCut + report.midSlotsCut > 0)
  const after = cut.reduce((s, d) => s + d.slots, 0)
  assert.equal(after, protectedSlots, 'flexible slots fully sacrificed down to protected floor')
  assert.equal(
    cut.filter((d) => d.kind === 'urgent').reduce((s, d) => s + d.slots, 0),
    demand.filter((d) => d.kind === 'urgent').reduce((s, d) => s + d.slots, 0),
    'urgent slots never cut',
  )
  assert.equal(
    cut.filter((d) => d.kind === 'anchor').reduce((s, d) => s + d.slots, 0),
    demand.filter((d) => d.kind === 'anchor').reduce((s, d) => s + d.slots, 0),
    'anchor slots never cut',
  )
  assert.equal(
    cut.filter((d) => d.kind === 'bandA').reduce((s, d) => s + d.slots, 0),
    demand.filter((d) => d.kind === 'bandA').reduce((s, d) => s + d.slots, 0),
    'band A slots never cut',
  )
  assert.equal(
    cut.filter((d) => d.kind === 'mid' || d.kind === 'newSample' || d.kind === 'bandB').length,
    0,
    'mid / newSample / bandB fully cut at protected floor',
  )
  console.log('Sacrifice ladder @ protected floor budget:', report)
  console.log('✓ Sacrifice never cuts Urgent / Anchor / Rotator / Band A')
}

// --- Band B sacrifice order: lowest CPI first ---
{
  const bandBDemand = [
    {
      product: {
        id: 'bb-hi',
        productName: 'High CPI BandB',
        productId: 'bb-hi',
        gmv: 100,
        commission: 12,
        itemsSold: 1,
        orderCount: 1,
        videosFilmed: 6,
        score: 0,
        tier: 'Test' as const,
        rankInTier: 1,
        inRotation: true,
        isManual: false,
        sopTier: 'BandB' as const,
        sopBand: 'B' as const,
      },
      kind: 'bandB' as const,
      slots: 2,
      commissionPerItem: 12,
    },
    {
      product: {
        id: 'bb-lo',
        productName: 'Low CPI BandB',
        productId: 'bb-lo',
        gmv: 100,
        commission: 8,
        itemsSold: 3,
        orderCount: 1,
        videosFilmed: 6,
        score: 0,
        tier: 'Test' as const,
        rankInTier: 2,
        inRotation: true,
        isManual: false,
        sopTier: 'BandB' as const,
        sopBand: 'B' as const,
      },
      kind: 'bandB' as const,
      slots: 2,
      commissionPerItem: 8 / 3,
    },
    {
      product: {
        id: 'anchor-keep',
        productName: 'Protected Anchor',
        productId: 'a1',
        gmv: 500,
        commission: 100,
        itemsSold: 20,
        orderCount: 5,
        videosFilmed: 6,
        score: 0,
        tier: 'Anchor' as const,
        rankInTier: 1,
        inRotation: true,
        isManual: false,
        sopTier: 'Anchor' as const,
      },
      kind: 'anchor' as const,
      slots: 3,
      commissionPerItem: 5,
    },
  ]
  // Budget 5 → keep anchor 3, keep 2 of bandB; cut lowest CPI first (Low CPI loses both, High keeps 2)
  const { demand: cut, report } = applySopSacrificeLadder(bandBDemand, 5)
  assert.equal(report.bandBSlotsCut, 2)
  assert.equal(report.bandBCuts[0]?.productName, 'Low CPI BandB')
  assert.equal(cut.find((d) => d.product.id === 'bb-lo')?.slots ?? 0, 0)
  assert.equal(cut.find((d) => d.product.id === 'bb-hi')?.slots, 2)
  assert.equal(cut.find((d) => d.product.id === 'anchor-keep')?.slots, 3)
  console.log('\n✓ Band B sacrifice cuts lowest CPI first:', report.bandBCuts)
}

// --- Full schedule build ---
const { schedule, sacrifice, budget, demand } = buildSopModeScheduleDetailed(
  tiered,
  config,
  [],
  new Set(),
  [],
  asOf,
)

console.log('\n--- Day-by-day SOP schedule (10 videos/day × 3 days) ---')
console.log(`Budget for products: ${budget} | Sacrifice:`, sacrifice)

for (const day of schedule) {
  console.log(`\nDay ${day.day} (${day.videos.length} slots):`)
  for (const v of day.videos) {
    console.log(
      `  [${v.tier}] ${v.productName} — ${v.placementReason ?? ''}`,
    )
  }
  assert.ok(day.videos.length <= config.videosPerDay, `day ${day.day} over cap`)
}

// Urgent: ≥2 slots on Day 1
const day1Urgent = schedule[0].videos.filter((v) => v.productKey === 'urgent-sample')
assert.ok(
  day1Urgent.length >= SOP_URGENT_DAY1_MIN_SLOTS,
  `Day 1 urgent slots ${day1Urgent.length} < ${SOP_URGENT_DAY1_MIN_SLOTS}`,
)
console.log(
  `\n✓ Urgent "${urgentSample.productName}" has ${day1Urgent.length} slots on Day 1`,
)

const totalPlaced = schedule.reduce((s, d) => s + d.videos.length, 0)
const sprintBudget = config.videosPerDay * config.sprintDays
assert.ok(
  totalPlaced <= sprintBudget,
  `total slots ${totalPlaced} must not exceed sprint budget ${sprintBudget}`,
)

// With only 1 New Sample, Day 2 must not fake-pad past the per-day cap.
const day2 = schedule[1]
const day2Serum = day2.videos.filter((v) => v.productName.includes('Vitamin C'))
assert.ok(
  day2Serum.length <= SOP_NEW_SAMPLE_MAX_PER_DAY,
  `Day 2 Vitamin C Serum ${day2Serum.length} > per-day cap ${SOP_NEW_SAMPLE_MAX_PER_DAY}`,
)
const day2Empty = config.videosPerDay - day2.videos.length
assert.ok(
  day2Empty > 0,
  'Day 2 should leave genuine empty slots when only 1 New Sample is available',
)
console.log(
  `\n✓ Single-NewSample fixture: Day 2 has ${day2.videos.length}/${config.videosPerDay} filled ` +
    `(Vitamin C ×${day2Serum.length}, empty ×${day2Empty}); total sprint ${totalPlaced}/${sprintBudget}`,
)

// No New Sample product exceeds per-day cap anywhere
for (const day of schedule) {
  const byProduct = new Map<string, number>()
  for (const v of day.videos) {
    if (!v.placementReason?.includes('New Sample')) continue
    byProduct.set(v.productKey, (byProduct.get(v.productKey) ?? 0) + 1)
  }
  for (const [id, n] of byProduct) {
    assert.ok(
      n <= SOP_NEW_SAMPLE_MAX_PER_DAY,
      `Day ${day.day} New Sample ${id} has ${n} > cap ${SOP_NEW_SAMPLE_MAX_PER_DAY}`,
    )
  }
}
console.log(`✓ No New Sample exceeds ${SOP_NEW_SAMPLE_MAX_PER_DAY}/day cap`)

// Mid products must not stack both sprint videos on one day when capacity exists
const midIds = new Set(
  demand.filter((d) => d.kind === 'mid').map((d) => d.product.id),
)
for (const midId of midIds) {
  const daysHit = schedule
    .map((d, idx) => (d.videos.some((v) => v.productKey === midId) ? idx + 1 : null))
    .filter((d): d is number => d != null)
  const slots = schedule.reduce(
    (s, d) => s + d.videos.filter((v) => v.productKey === midId).length,
    0,
  )
  if (slots >= 2) {
    assert.ok(
      new Set(daysHit).size >= 2,
      `Mid ${midId} stacked on one day: days=${daysHit.join(',')}`,
    )
  }
}
console.log('✓ Mid products with 2+ slots span distinct days')

// Anchors appear across days when present
const anchors = demand.filter((d) => d.kind === 'anchor')
if (anchors.length > 0) {
  const anchorId = anchors[0].product.id
  const daysWithAnchor = schedule.filter((d) =>
    d.videos.some((v) => v.productKey === anchorId),
  ).length
  console.log(`✓ Anchor "${anchors[0].product.productName}" on ${daysWithAnchor}/${config.sprintDays} days`)
}

console.log('\n--- Copy Schedule text (grouped) ---\n')
console.log(formatScheduleText(schedule))

// --- Multi New Sample fixture: padding must distribute across distinct products ---
{
  console.log('\n--- Multi New Sample padding fixture ---')
  const multiNs = Array.from({ length: 8 }, (_, i) => ({
    id: `ns-${i}`,
    productName: `New Sample ${String(i).padStart(2, '0')}`,
    productId: `ns-${i}`,
    gmv: 10,
    commission: 3 - i * 0.1,
    itemsSold: 1,
    orderCount: 1,
    videosFilmed: 1,
    inRotation: true,
    isManual: false,
  }))
  const multiPool = [
    ...fillers.map(({ score: _s, tier: _t, rankInTier: _r, ...rest }) => rest),
    {
      ...earbuds,
      videosFilmed: 6,
      commission: 24.4,
      itemsSold: 7,
      gmv: 139.93,
    },
    {
      ...lamp,
      videosFilmed: 6,
      commission: 14.11,
      itemsSold: 4,
      gmv: 90,
    },
    urgentSample,
    ...multiNs,
  ]
  const { products: multiTiered } = tierProductsSop(multiPool, {
    dailyVolume: config.videosPerDay,
    sprintDays: config.sprintDays,
    asOfDate: asOf,
  })
  const nsTier = multiTiered.filter((p) => p.sopTier === 'NewSample')
  assert.ok(nsTier.length >= 4, `expected several NewSample tiers, got ${nsTier.length}`)
  console.log(
    `NewSample products available: ${nsTier.map((p) => p.productName).join(', ')}`,
  )

  const { schedule: multiSchedule } = buildSopModeScheduleDetailed(
    multiTiered,
    config,
    [],
    new Set(),
    [],
    asOf,
  )

  for (const day of multiSchedule) {
    console.log(`\nDay ${day.day} (${day.videos.length} slots):`)
    for (const v of day.videos) {
      console.log(`  [${v.tier}] ${v.productName} — ${v.placementReason ?? ''}`)
    }
    const nsVideos = day.videos.filter((v) => v.placementReason?.includes('New Sample'))
    const distinctNs = new Set(nsVideos.map((v) => v.productKey))
    for (const id of distinctNs) {
      const n = nsVideos.filter((v) => v.productKey === id).length
      assert.ok(n <= SOP_NEW_SAMPLE_MAX_PER_DAY, `multi fixture Day ${day.day} ${id} ×${n}`)
    }
    // When several New Samples exist and the day needed padding, prefer variety
    // over repeating one product (at most 1 repeat once others are used).
    if (nsVideos.length > SOP_NEW_SAMPLE_MAX_PER_DAY && nsTier.length >= nsVideos.length) {
      assert.equal(
        distinctNs.size,
        nsVideos.length,
        `Day ${day.day}: enough distinct New Samples exist — expected no repeats, ` +
          `got ${nsVideos.length} slots across ${distinctNs.size} products`,
      )
    }
  }

  const multiTotal = multiSchedule.reduce((s, d) => s + d.videos.length, 0)
  console.log(
    `\n✓ Multi-NewSample fixture: ${multiTotal}/${sprintBudget} slots; ` +
      `padding distributed across distinct products (cap ${SOP_NEW_SAMPLE_MAX_PER_DAY}/day)`,
  )
}

console.log('\n' + '='.repeat(72))
console.log('verify-sop-schedule: PASS')
console.log('='.repeat(72))

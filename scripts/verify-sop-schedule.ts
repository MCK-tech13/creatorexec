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

console.log('\n' + '='.repeat(72))
console.log('verify-sop-schedule: PASS')
console.log('='.repeat(72))

/**
 * SOP tier scaling math — verification matrix + 30×3 baseline product counts.
 *
 * Usage: npx tsx scripts/verify-sop-tier-scaling.ts
 */
import assert from 'node:assert/strict'
import {
  computeSopScaling,
  roundSopMoney,
  SOP_COMMISSION_PER_ITEM_MIN,
  SOP_HIGH_TICKET_COMMISSION_PER_ITEM,
} from '../src/lib/analysis/sopTierEngine'
import type { SprintDays } from '../src/types'

function assertMoney(actual: number, expected: number, label: string) {
  assert.equal(
    roundSopMoney(actual),
    roundSopMoney(expected),
    `${label}: got ${actual}, expected ${expected}`,
  )
}

type MatrixRow = {
  dailyVolume: number
  sprintDays: SprintDays
  bandA: number
  bandB: number
  floorA?: boolean
  floorB?: boolean
}

/** User-confirmed verification table (A / B after hard floors). */
const MATRIX: MatrixRow[] = [
  { dailyVolume: 30, sprintDays: 3, bandA: 15, bandB: 5 },
  { dailyVolume: 30, sprintDays: 7, bandA: 35, bandB: 11.67 },
  { dailyVolume: 30, sprintDays: 14, bandA: 70, bandB: 23.33 },
  { dailyVolume: 15, sprintDays: 3, bandA: 7.5, bandB: 2.5 },
  { dailyVolume: 15, sprintDays: 7, bandA: 17.5, bandB: 5.83 },
  { dailyVolume: 15, sprintDays: 14, bandA: 35, bandB: 11.67 },
  { dailyVolume: 10, sprintDays: 3, bandA: 5, bandB: 2, floorB: true },
  // Band A proportional equals $5 exactly at 10×3 — floor does not raise it.
  { dailyVolume: 10, sprintDays: 7, bandA: 11.67, bandB: 3.89 },
  { dailyVolume: 10, sprintDays: 14, bandA: 23.33, bandB: 7.78 },
  { dailyVolume: 5, sprintDays: 3, bandA: 5, bandB: 2, floorA: true, floorB: true },
  { dailyVolume: 5, sprintDays: 7, bandA: 5.83, bandB: 2, floorB: true },
  // Exact $5/3 scaling: (5/3)×(5/30)×14 = 35/9 ≈ $3.89 (table's $4.08 was a typo under exact fraction).
  { dailyVolume: 5, sprintDays: 14, bandA: 11.67, bandB: 3.89 },
]

console.log('SOP Band A / Band B verification matrix')
console.log('Daily | Sprint | Band A | Band B | floors')
for (const row of MATRIX) {
  const result = computeSopScaling({
    dailyVolume: row.dailyVolume,
    sprintDays: row.sprintDays,
  })
  assertMoney(
    result.bands.sprintBandAThreshold,
    row.bandA,
    `${row.dailyVolume}×${row.sprintDays} Band A`,
  )
  assertMoney(
    result.bands.sprintBandBThreshold,
    row.bandB,
    `${row.dailyVolume}×${row.sprintDays} Band B`,
  )
  if (row.floorA) {
    assert.equal(
      result.bands.bandAFloorApplied,
      true,
      `${row.dailyVolume}×${row.sprintDays} expected Band A floor`,
    )
  }
  if (row.floorB) {
    assert.equal(
      result.bands.bandBFloorApplied,
      true,
      `${row.dailyVolume}×${row.sprintDays} expected Band B floor`,
    )
  }
  const flags = [
    result.bands.bandAFloorApplied ? 'A*' : '',
    result.bands.bandBFloorApplied ? 'B*' : '',
  ]
    .filter(Boolean)
    .join(' ')
  console.log(
    `${String(row.dailyVolume).padStart(5)} | ${String(row.sprintDays).padStart(6)} | $${roundSopMoney(result.bands.sprintBandAThreshold).toFixed(2).padStart(6)} | $${roundSopMoney(result.bands.sprintBandBThreshold).toFixed(2).padStart(6)} | ${flags || '—'}`,
  )
}

// --- 30/day × 3-day baseline must reproduce original SOP slot/product counts ---
const baseline = computeSopScaling({ dailyVolume: 30, sprintDays: 3 })
assert.equal(baseline.slots.totalSlots, 90)
assert.equal(baseline.slots.anchorSlots, 12)
assert.equal(baseline.slots.rotatorSlots, 12)
assert.equal(baseline.slots.midSlots, 30)
assert.equal(baseline.slots.newSampleFillSlots, 36)
assert.equal(baseline.products.anchorVideosPerProduct, 3)
assert.equal(baseline.products.anchorProductCount, 4)
assert.equal(baseline.products.rotatorProductCount, 6)
assert.equal(baseline.products.midProductCount, 15)
assertMoney(baseline.bands.sprintBandAThreshold, 15, 'baseline Band A')
assertMoney(baseline.bands.sprintBandBThreshold, 5, 'baseline Band B')

// Anchor videos/product = sprintDays (Option A)
assert.equal(
  computeSopScaling({ dailyVolume: 30, sprintDays: 7 }).products.anchorVideosPerProduct,
  7,
)
assert.equal(
  computeSopScaling({ dailyVolume: 30, sprintDays: 14 }).products.anchorVideosPerProduct,
  14,
)

// Fixed (non-scaling) qualification constants
assert.equal(SOP_COMMISSION_PER_ITEM_MIN, 2)
assert.equal(SOP_HIGH_TICKET_COMMISSION_PER_ITEM, 10)
assert.equal(baseline.commissionPerItemMin, 2)
assert.equal(baseline.highTicketCommissionPerItem, 10)

// Editable floors override defaults
const customFloors = computeSopScaling({
  dailyVolume: 5,
  sprintDays: 3,
  floors: { bandAFloor: 8, bandBFloor: 3 },
})
assertMoney(customFloors.bands.sprintBandAThreshold, 8, 'custom Band A floor')
assertMoney(customFloors.bands.sprintBandBThreshold, 3, 'custom Band B floor')

console.log('')
console.log('30×3 baseline: 4 Anchors / 6 Rotators / Mid 15 / Band A $15 / Band B $5 — OK')
console.log('verify-sop-tier-scaling: PASS')

/**
 * Focused checks for Product Scout scoring tiers:
 * - Creator Saturation ≥2K → 0 + warning
 * - Growth magnitude tiers + combined bonus cap
 * - previous === 0 (new product) → max tier without divide-by-zero
 *
 * Usage: npx tsx scripts/verify-product-scout-scoring-tiers.ts
 */
import assert from 'node:assert/strict'
import {
  growthMultipleFromDelta,
  scoreProductScout,
} from '../src/lib/productScout/scorer.ts'
import type { ProductScoutMetrics } from '../src/types/productScout.ts'

function base(overrides: Partial<ProductScoutMetrics> = {}): ProductScoutMetrics {
  return {
    orders: { value: '10K', delta: '+1K' },
    ctr: { value: '3.5', delta: '+0.1' },
    creators: { value: '500', delta: '+10' },
    atcUsers: { value: '40K', delta: '+2K' },
    ...overrides,
  }
}

// --- growthMultipleFromDelta ---
assert.deepEqual(growthMultipleFromDelta(1200, 1000), {
  multiple: 6,
  noBaseline: false,
})
assert.deepEqual(growthMultipleFromDelta(500, 500), {
  multiple: null,
  noBaseline: true,
})
assert.deepEqual(growthMultipleFromDelta(null, 100), {
  multiple: null,
  noBaseline: false,
})

// --- Creator saturation ≥2K is neutral + warning ---
{
  const result = scoreProductScout(
    base({
      creators: { value: '8.8K', delta: '+100' },
      orders: { value: '24.1K', delta: '+3.6K' },
    }),
  )
  assert.ok(result)
  const creator = result.signals.find((s) => s.id === 'creator-saturation')
  assert.ok(creator)
  assert.equal(creator.points, 0)
  assert.equal(creator.sentiment, 'neutral')
  assert.match(
    creator.warning ?? '',
    /Higher creator competition \(8\.8K creators\)/,
  )
}

// --- Creators climbing while orders down still -2 ---
{
  const result = scoreProductScout(
    base({
      creators: { value: '3K', delta: '+200' },
      orders: { value: '10K', delta: '-500' },
    }),
  )
  assert.ok(result)
  const creator = result.signals.find((s) => s.id === 'creator-saturation')
  assert.equal(creator?.points, -2)
  assert.equal(creator?.warning, undefined)
}

// --- Magnitude tiers on Orders ---
{
  // <2x: 10K / 9K ≈ 1.1x → +1
  const low = scoreProductScout(
    base({
      orders: { value: '10K', delta: '+1K' },
      atcUsers: { value: '40K', delta: '' },
    }),
  )
  assert.equal(low?.signals.find((s) => s.id === 'orders-trend')?.points, 1)

  // 2x-5x: 10K / 4K = 2.5x → +2
  const mid = scoreProductScout(
    base({
      orders: { value: '10K', delta: '+6K' },
      atcUsers: { value: '40K', delta: '' },
    }),
  )
  const midOrders = mid?.signals.find((s) => s.id === 'orders-trend')
  assert.equal(midOrders?.points, 2)
  assert.match(midOrders?.detail ?? '', /2\.5x — solid demand surge/)

  // >5x: 12K / 2K = 6x → +3
  const high = scoreProductScout(
    base({
      orders: { value: '12K', delta: '+10K' },
      atcUsers: { value: '40K', delta: '' },
    }),
  )
  const highOrders = high?.signals.find((s) => s.id === 'orders-trend')
  assert.equal(highOrders?.points, 3)
  assert.match(highOrders?.detail ?? '', /6x — strong demand surge/)
}

// --- previous === 0 → max tier, no divide-by-zero, fallback copy ---
{
  const result = scoreProductScout(
    base({
      orders: { value: '500', delta: '+500' },
      atcUsers: { value: '40K', delta: '' },
    }),
  )
  const orders = result?.signals.find((s) => s.id === 'orders-trend')
  assert.equal(orders?.points, 3)
  assert.match(orders?.detail ?? '', /new product, no baseline yet/)
  assert.doesNotMatch(orders?.detail ?? '', /Infinity|NaN/)
}

{
  const result = scoreProductScout(
    base({
      orders: { value: '10K', delta: '' },
      atcUsers: { value: '800', delta: '+800' },
    }),
  )
  const atc = result?.signals.find((s) => s.id === 'atc-trend')
  assert.equal(atc?.points, 3)
  assert.match(atc?.detail ?? '', /ATC users up sharply — new product, no baseline yet/)
}

// --- Combined magnitude bonus cap +2 (both >5x → one keeps +3, other drops to +1) ---
{
  const result = scoreProductScout(
    base({
      orders: { value: '12K', delta: '+10K' }, // 6x → uncapped +3
      atcUsers: { value: '12K', delta: '+10K' }, // 6x → uncapped +3
      creators: { value: '100', delta: '+1' },
      ctr: { value: '5', delta: '+0.2' },
    }),
  )
  assert.ok(result)
  const orders = result.signals.find((s) => s.id === 'orders-trend')
  const atc = result.signals.find((s) => s.id === 'atc-trend')
  assert.equal(orders?.points, 3) // Orders wins tie
  assert.equal(atc?.points, 1) // remainder after cap
  const bonus = (orders!.points - 1) + (atc!.points - 1)
  assert.equal(bonus, 2)
}

// --- ATC down scores -1; conversion scoring unchanged (10K/40K = 25% → +2) ---
{
  const result = scoreProductScout(
    base({
      orders: { value: '10K', delta: '+1K' },
      atcUsers: { value: '40K', delta: '-2K' },
    }),
  )
  assert.equal(result?.signals.find((s) => s.id === 'atc-trend')?.points, -1)
  assert.equal(result?.signals.find((s) => s.id === 'atc-conversion')?.points, 2)
}

console.log('Product Scout scoring-tier checks passed.')

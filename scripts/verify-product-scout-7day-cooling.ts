/**
 * Optional 7-day cooling overlay + confirm 30-day-only scoring unchanged.
 *
 * Usage: npx tsx scripts/verify-product-scout-7day-cooling.ts
 */
import assert from 'node:assert/strict'
import {
  COOLING_DECLINE_MILD_MAX,
  COOLING_DECLINE_NOISE_MAX,
  declineFractionFromDelta,
  scoreProductScout,
  SCORING_LOGIC_VERSION,
} from '../src/lib/productScout/scorer'
import type { ProductScoutMetrics } from '../src/types/productScout'

assert.equal(SCORING_LOGIC_VERSION, 3)
assert.equal(COOLING_DECLINE_NOISE_MAX, 0.15)
assert.equal(COOLING_DECLINE_MILD_MAX, 0.35)

function base30(overrides: Partial<ProductScoutMetrics> = {}): ProductScoutMetrics {
  return {
    orders: { value: '20K', delta: '+4K' }, // growing 30-day
    ctr: { value: '3.5', delta: '+0.1' },
    creators: { value: '500', delta: '+10' },
    atcUsers: { value: '50K', delta: '+5K' },
    ...overrides,
  }
}

console.log('='.repeat(64))
console.log('Product Scout 7-day cooling verification')
console.log('='.repeat(64))

// Decline math: current 10K, delta -4K → previous 14K → 4000/14000 ≈ 28.6%
assert.ok(
  Math.abs((declineFractionFromDelta(10000, -4000) ?? 0) - 4000 / 14000) < 1e-9,
)

const thirtyDayOnly = base30()
const baseline = scoreProductScout(thirtyDayOnly)
assert.ok(baseline)
const baselineTotal = baseline.totalScore
const baselineSignalIds = baseline.signals.map((s) => s.id).sort()
assert.ok(!baseline.signals.some((s) => s.id === 'recent-cooling'))
console.log(`\n30-day-only baseline total=${baselineTotal} signals=${baselineSignalIds.join(',')}`)

// Empty recent7d object should not change score
{
  const withEmpty = scoreProductScout({
    ...thirtyDayOnly,
    recent7d: {
      orders: { value: '', delta: '' },
      atcUsers: { value: '', delta: '' },
    },
  })
  assert.equal(withEmpty?.totalScore, baselineTotal)
  assert.ok(!withEmpty?.signals.some((s) => s.id === 'recent-cooling'))
  console.log('empty recent7d → identical total, no cooling signal ✓')
}

// Under 15% noise: 10K with -1K → previous 11K → ~9.1%
{
  const result = scoreProductScout({
    ...thirtyDayOnly,
    recent7d: {
      orders: { value: '10K', delta: '-1K' },
      atcUsers: { value: '20K', delta: '+500' },
    },
  })
  assert.equal(result?.totalScore, baselineTotal)
  assert.equal(
    result?.signals.find((s) => s.id === 'recent-cooling'),
    undefined,
  )
  console.log('\nTIER noise (<15%): no penalty, total unchanged ✓')
}

// Mild 15–35%: 10K with -3K → previous 13K → ~23.1%
{
  const result = scoreProductScout({
    ...thirtyDayOnly,
    recent7d: {
      orders: { value: '10K', delta: '-3K' },
      atcUsers: { value: '20K', delta: '' },
    },
  })
  const cooling = result?.signals.find((s) => s.id === 'recent-cooling')
  assert.ok(cooling)
  assert.equal(cooling.points, -1)
  assert.equal(cooling.label, 'Cooling (mild)')
  assert.match(cooling.detail, /orders down 23%/)
  assert.match(cooling.detail, /despite 30-day growth/)
  assert.equal(cooling.warning, cooling.detail)
  assert.equal(result?.totalScore, baselineTotal - 1)
  console.log('\nTIER mild (15–35%): -1')
  console.log(`  badge: ${cooling.detail}`)
  console.log(`  total ${baselineTotal} → ${result?.totalScore} ✓`)
}

// Significant >35%: 10K with -5K → previous 15K → ~33.3% is still mild!
// Need >35%: 10K with -6K → previous 16K → 37.5%
{
  const result = scoreProductScout({
    ...thirtyDayOnly,
    recent7d: {
      orders: { value: '10K', delta: '-6K' },
      atcUsers: { value: '20K', delta: '' },
    },
  })
  const cooling = result?.signals.find((s) => s.id === 'recent-cooling')
  assert.ok(cooling)
  assert.equal(cooling.points, -2)
  assert.equal(cooling.label, 'Cooling (significant)')
  assert.match(cooling.detail, /orders down 38%/)
  assert.equal(result?.totalScore, baselineTotal - 2)
  console.log('\nTIER significant (>35%): -2')
  console.log(`  badge: ${cooling.detail}`)
  console.log(`  total ${baselineTotal} → ${result?.totalScore} ✓`)
}

// Steeper of orders vs ATC drives tier; copy lists both declined metrics
{
  // orders ~23% (mild alone), ATC 10K with -5K → 33.3% still mild; bump ATC to >35%
  // ATC 10K delta -5K = 33.3%; use -6K = 37.5% significant while orders mild
  const result = scoreProductScout({
    ...thirtyDayOnly,
    recent7d: {
      orders: { value: '10K', delta: '-3K' }, // ~23%
      atcUsers: { value: '10K', delta: '-6K' }, // ~38%
    },
  })
  const cooling = result?.signals.find((s) => s.id === 'recent-cooling')
  assert.ok(cooling)
  assert.equal(cooling.points, -2, 'steeper ATC decline drives significant tier')
  assert.match(cooling.detail, /orders down 23%/)
  assert.match(cooling.detail, /ATC down 38%/)
  console.log('\nSteeper-of-two + both listed:')
  console.log(`  ${cooling.detail} ✓`)
}

// Gate: 30-day orders NOT growing → no cooling even with steep 7-day drop
{
  const result = scoreProductScout({
    ...thirtyDayOnly,
    orders: { value: '20K', delta: '-2K' },
    recent7d: {
      orders: { value: '10K', delta: '-6K' },
      atcUsers: { value: '', delta: '' },
    },
  })
  assert.equal(result?.signals.find((s) => s.id === 'recent-cooling'), undefined)
  console.log('\nGate: 30-day orders not growing → no cooling ✓')
}

// Confirm 30-day-only fixture matches pre-cooling totals for a known case from tiers script
{
  const low = scoreProductScout(
    base30({
      orders: { value: '10K', delta: '+1K' },
      atcUsers: { value: '40K', delta: '' },
      creators: { value: '500', delta: '+10' },
      ctr: { value: '3.5', delta: '+0.1' },
    }),
  )
  assert.equal(low?.signals.find((s) => s.id === 'orders-trend')?.points, 1)
  assert.ok(!low?.signals.some((s) => s.id === 'recent-cooling'))
  console.log('\n30-day-only Orders Trend +1 (unchanged from prior behavior) ✓')
}

console.log('\nverify-product-scout-7day-cooling: PASS')

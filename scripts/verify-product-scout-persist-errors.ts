/**
 * Verifies Product Scout persist error surfacing + INSERT-vs-UPDATE semantics.
 * Run: npx tsx scripts/verify-product-scout-persist-errors.ts
 */
import assert from 'node:assert/strict'
import { createProductScoutEntry } from '../src/lib/productScout/productScoutStorage'
import { productScoutToRow } from '../src/lib/supabase/mappers'
import { scoreProductScout } from '../src/lib/productScout/scorer'
import type { ProductScoutMetrics } from '../src/types/productScout'

const metrics: ProductScoutMetrics = {
  orders: { value: '2.5K', delta: '+2.1K' },
  ctr: { value: '3.2', delta: '-0.3' },
  creators: { value: '500', delta: '+67' },
  atcUsers: { value: '20K', delta: '+13.5K' },
}

const live = scoreProductScout(metrics)
assert.ok(live)
assert.equal(live.verdict, 'test')
assert.ok(live.totalScore >= 1)

// Add always allocates a fresh UUID — never matches by product name.
const a = createProductScoutEntry({ productName: 'Hadley Designs - Busy Book', metrics })
const b = createProductScoutEntry({ productName: 'Hadley Designs - Busy Book', metrics })
assert.notEqual(a.id, b.id)

const row = productScoutToRow('00000000-0000-4000-8000-000000000099', a)
assert.equal(row.verdict, 'test')
assert.equal(row.total_score, live.totalScore)
assert.equal(row.scoring_logic_version, 2)

// insufficient maps to null for the DB enum (never sent as "insufficient")
const weakMetrics: ProductScoutMetrics = {
  orders: { value: '100', delta: '' },
  ctr: { value: '', delta: '' },
  creators: { value: '', delta: '' },
  atcUsers: { value: '', delta: '' },
}
const weak = scoreProductScout(weakMetrics)
assert.ok(weak)
assert.equal(weak.verdict, 'insufficient')
const weakRow = productScoutToRow('00000000-0000-4000-8000-000000000099', {
  ...a,
  metrics: weakMetrics,
})
assert.equal(weakRow.verdict, null)

console.log('verify-product-scout-persist-errors: PASS')
console.log(
  [
    `- Live UI score for Hadley-like metrics: ${live.verdictLabel} (+${live.totalScore})`,
    `- Add creates distinct UUIDs for same name: ${a.id.slice(0, 8)} vs ${b.id.slice(0, 8)}`,
    `- Mapper writes scoring_logic_version=${row.scoring_logic_version}, verdict=${row.verdict}`,
    `- insufficient → DB null (not enum violation)`,
  ].join('\n'),
)

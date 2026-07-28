/**
 * Proof cases for:
 * 1) Merge keys — different products stay split; duplicate listings merge
 * 2) Catalog reconcile — prune stale CSV; keep manual/sample
 *
 * Usage: npx tsx scripts/verify-catalog-stale-and-merge.ts
 */
import assert from 'node:assert/strict'
import {
  aggregateOrdersByProduct,
  getSignificantWordsMergeKey,
} from '../src/lib/analysis/orderAggregator'
import {
  buildSprintProductsFromCatalog,
} from '../src/lib/catalog/catalogSprint'
import {
  clearProductCatalog,
  isProtectedFromCsvPrune,
  loadProductCatalog,
  reconcileCatalogFromCsvUpload,
  upsertCatalogFromMergedProducts,
  upsertCatalogFromSampleProducts,
} from '../src/lib/catalog/productCatalogStorage'
import { clearDataStore, hydrateDataStore } from '../src/lib/supabase/dataStore'
import type { MergedProduct, SampleProduct } from '../src/types'
import { emptyUserEngagement } from '../src/types/userEngagement'

const memory = new Map<string, string>()
;(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value)
  },
  removeItem: (key) => {
    memory.delete(key)
  },
  clear: () => memory.clear(),
  key: () => null,
  length: 0,
}

function emptySnapshot() {
  return {
    trialProgress: {},
    brandDeals: [],
    incomeTracker: [],
    productScoutEntries: [],
    productCatalog: [],
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
  hydrateDataStore('proof-user', emptySnapshot())
  clearProductCatalog()
}

function csvProduct(
  partial: Pick<MergedProduct, 'id' | 'productName' | 'productId' | 'commission'> &
    Partial<MergedProduct>,
): MergedProduct {
  return {
    gmv: partial.gmv ?? partial.commission * 10,
    itemsSold: partial.itemsSold ?? 1,
    orderCount: partial.orderCount ?? 1,
    videosFilmed: 0,
    score: 0,
    tier: 'Rising',
    rankInTier: 0,
    inRotation: true,
    isManual: false,
    ...partial,
  }
}

function order(
  productName: string,
  productId: string,
  commission: number,
  itemsSold = 1,
) {
  return {
    productName,
    productId,
    gmv: commission * 10,
    itemsSold,
    estStandardCommission: commission,
    estShopAdsCommission: 0,
  }
}

console.log('='.repeat(64))
console.log('PROOF 1 — Merge key distinctions')
console.log('='.repeat(64))

const charcoal = 'Dr.Leo Charcoal Cleansing Clay Stick'
const dryingLotion = 'Dr.Leo Drying Lotion'
const dryingLiquidA = 'Dr.Leo Drying Liquid'
const dryingLiquidB = 'Dr.Leo Drying Liquid Acne Spot Treatment'
const dryingLiquidTagged = 'Dr.Leo Drying Liquid (Beauty)'
const leefarA = 'LEEFAR Her Juicy Feminine Probiotics Gummies'
const leefarB = 'LEEFAR Her Juicy Feminine Probiotics Gummies 60ct'

console.log('\nMerge keys:')
for (const name of [
  charcoal,
  dryingLotion,
  dryingLiquidA,
  dryingLiquidB,
  dryingLiquidTagged,
  leefarA,
  leefarB,
]) {
  console.log(`  ${getSignificantWordsMergeKey(name).padEnd(28)} ← ${name}`)
}

// (a) Different products — must NOT share a key
assert.notEqual(
  getSignificantWordsMergeKey(charcoal),
  getSignificantWordsMergeKey(dryingLotion),
  'Charcoal Stick vs Drying Lotion must NOT share a merge key',
)
assert.notEqual(
  getSignificantWordsMergeKey(charcoal),
  getSignificantWordsMergeKey(dryingLiquidA),
  'Charcoal Stick vs Drying Liquid must NOT share a merge key',
)
console.log('\n(a) Dr.Leo Charcoal Stick vs Dr.Leo Drying Lotion → DISTINCT keys ✓')

// (b) Near-identical listings — MUST share a key
assert.equal(
  getSignificantWordsMergeKey(dryingLiquidA),
  getSignificantWordsMergeKey(dryingLiquidB),
  'Drying Liquid listings with trailing descriptor must merge',
)
assert.equal(
  getSignificantWordsMergeKey(dryingLiquidA),
  getSignificantWordsMergeKey(dryingLiquidTagged),
  'Drying Liquid with trailing (Beauty) tag must merge',
)
assert.equal(
  getSignificantWordsMergeKey(leefarA),
  getSignificantWordsMergeKey(leefarB),
  'LEEFAR Gummies + 60ct listing must merge',
)
console.log('(b) Near-identical Drying Liquid listings → SAME key ✓')
console.log('(b) LEEFAR Probiotics Gummies variants → SAME key ✓')

// Aggregate proof: one file with all of the above
const aggregated = aggregateOrdersByProduct([
  order(charcoal, 'c1', 9.15, 6),
  order(charcoal + ' Soft', 'c2', 9.14, 6), // same first-3 as charcoal after Soft?
  order(dryingLotion, 'd1', 9.97, 2),
  order(dryingLiquidA, 'l1', 5.0, 3),
  order(dryingLiquidB, 'l2', 7.0, 4),
  order(leefarA, 'f1', 100, 15),
  order(leefarB, 'f2', 38.45, 7),
])

console.log('\nAggregated products from mixed file:')
for (const p of aggregated) {
  console.log(
    `  $${p.commission.toFixed(2).padStart(7)} / ${String(p.itemsSold).padStart(2)} sold  ${p.productName}`,
  )
}

const charcoalRows = aggregated.filter((p) =>
  p.productName.toLowerCase().includes('charcoal'),
)
const lotionRows = aggregated.filter((p) =>
  p.productName.toLowerCase().includes('drying lotion'),
)
const liquidRows = aggregated.filter((p) =>
  p.productName.toLowerCase().includes('drying liquid'),
)
const leefarRows = aggregated.filter((p) =>
  p.productName.toLowerCase().includes('leefar'),
)

assert.equal(charcoalRows.length, 1, 'charcoal variants → 1 product')
assert.equal(Number(charcoalRows[0].commission.toFixed(2)), 18.29)
assert.equal(lotionRows.length, 1, 'drying lotion stays its own product')
assert.equal(Number(lotionRows[0].commission.toFixed(2)), 9.97)
assert.equal(liquidRows.length, 1, 'drying liquid listings merge to 1')
assert.equal(Number(liquidRows[0].commission.toFixed(2)), 12.0)
assert.equal(leefarRows.length, 1, 'LEEFAR listings merge to 1')
assert.equal(Number(leefarRows[0].commission.toFixed(2)), 138.45)

// Critical: charcoal must NOT absorb lotion/liquid
assert.ok(
  !aggregated.some(
    (p) =>
      p.productName.includes('Charcoal') &&
      Math.abs(p.commission - (18.29 + 9.97 + 12)) < 0.01,
  ),
  'Charcoal must not include lotion/liquid commissions',
)
console.log('\nAggregate checks:')
console.log('  Charcoal listings merged → $18.29 (not absorbing other Dr.Leo) ✓')
console.log('  Drying Lotion separate → $9.97 ✓')
console.log('  Drying Liquid listings merged → $12.00 ✓')
console.log('  LEEFAR listings merged → $138.45 ✓')

console.log('\n' + '='.repeat(64))
console.log('PROOF 2 — Catalog prune vs keep-manual')
console.log('='.repeat(64))

resetStore()

const sampleId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
upsertCatalogFromSampleProducts([
  {
    id: sampleId,
    productName: 'Gifted Serum Still Testing',
    brand: 'SampleCo',
    dateReceived: '2026-07-20',
    type: 'sample',
  } satisfies SampleProduct,
])

const manualId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
upsertCatalogFromMergedProducts([
  csvProduct({
    id: manualId,
    productName: 'Manual Favorite Cream',
    productId: 'manual',
    commission: 0,
    itemsSold: 0,
    isManual: true,
    tier: 'Test',
  }),
])

// Upload 1 — stale inflated CSV world
reconcileCatalogFromCsvUpload([
  csvProduct({
    id: 'csv-charcoal-old',
    productName: charcoal,
    productId: '111',
    commission: 287.69,
    itemsSold: 76,
  }),
  csvProduct({
    id: 'csv-lotion-old',
    productName: dryingLotion,
    productId: '222',
    commission: 115.7,
    itemsSold: 35,
  }),
  csvProduct({
    id: 'csv-gone',
    productName: 'Only In Old Report Widget',
    productId: '999',
    commission: 50,
    itemsSold: 10,
  }),
])

let catalog = loadProductCatalog()
console.log('\nAfter upload 1 (old report + sample + manual):')
for (const p of catalog) {
  console.log(
    `  [${p.source.padEnd(6)}] $${p.commission.toFixed(2).padStart(7)}  ${p.displayName}`,
  )
}
assert.equal(catalog.length, 5)

// Upload 2 — current report: charcoal real $18.29, lotion $9.97, old widget gone
reconcileCatalogFromCsvUpload([
  csvProduct({
    id: 'csv-charcoal-new',
    productName: charcoal,
    productId: '111',
    commission: 18.29,
    itemsSold: 12,
    orderCount: 12,
  }),
  csvProduct({
    id: 'csv-lotion-new',
    productName: dryingLotion,
    productId: '222',
    commission: 9.97,
    itemsSold: 2,
    orderCount: 2,
  }),
])

catalog = loadProductCatalog()
const sprint = buildSprintProductsFromCatalog(undefined, {
  mode: 'sop',
  dailyVolume: 30,
  sprintDays: 3,
})

console.log('\nAfter upload 2 (current report reconcile):')
for (const p of catalog) {
  const flag = isProtectedFromCsvPrune(p) ? 'KEEP' : 'csv  '
  console.log(
    `  [${flag}] [${p.source.padEnd(6)}] $${p.commission.toFixed(2).padStart(7)} / ${String(p.itemsSold).padStart(2)}  ${p.displayName}`,
  )
}

const charcoalCat = catalog.find((p) => p.displayName.includes('Charcoal'))
const lotionCat = catalog.find((p) => p.displayName.includes('Drying Lotion'))
const gone = catalog.find((p) => p.displayName.includes('Only In Old'))
const sample = catalog.find((p) => p.id === sampleId)
const manual = catalog.find((p) => p.id === manualId)

assert.ok(charcoalCat, 'charcoal still present')
assert.equal(Number(charcoalCat!.commission.toFixed(2)), 18.29)
assert.equal(charcoalCat!.itemsSold, 12)
assert.ok(lotionCat, 'lotion still present')
assert.equal(Number(lotionCat!.commission.toFixed(2)), 9.97)
assert.equal(lotionCat!.itemsSold, 2)
assert.equal(gone, undefined, 'stale CSV-only product must be pruned')
assert.ok(sample, 'sample must be kept')
assert.equal(sample!.source, 'sample')
assert.ok(manual, 'manual must be kept')
assert.ok(isProtectedFromCsvPrune(sample!))
assert.ok(isProtectedFromCsvPrune(manual!))
assert.ok(sprint.some((p) => p.id === sampleId), 'sprint still includes sample')
assert.ok(sprint.some((p) => p.productName.includes('Charcoal')))
assert.ok(!sprint.some((p) => p.productName.includes('Only In Old')))

console.log('\nReconcile checks:')
console.log('  Charcoal CSV refreshed $287.69 → $18.29 / 12 ✓')
console.log('  Drying Lotion CSV refreshed $115.70 → $9.97 / 2 ✓')
console.log('  Stale CSV "Only In Old Report Widget" pruned ✓')
console.log('  Sample "Gifted Serum Still Testing" kept ✓')
console.log('  Manual "Manual Favorite Cream" kept ✓')

console.log('\nverify-catalog-stale-and-merge: PASS')

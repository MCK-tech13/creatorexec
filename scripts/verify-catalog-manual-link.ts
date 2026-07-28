/**
 * Proof: manual product linking for the two real Dr.Leo pairs.
 * - Sales sum; videos filmed = max (not sum)
 * - Absorbed TikTok IDs point at survivor
 * - Future CSV with either ID updates one row
 * - Undo restores prior catalog + trial
 * - Prints confirm-dialog copy
 *
 * Usage: npx tsx scripts/verify-catalog-manual-link.ts
 */
import assert from 'node:assert/strict'
import {
  formatMergeConfirmSummary,
  latestUndoableMerge,
  mergeCatalogProducts,
  previewCatalogProductMerge,
  undoCatalogProductMerge,
} from '../src/lib/catalog/catalogProductLinking'
import {
  clearProductCatalog,
  loadProductCatalog,
  reconcileCatalogFromCsvUpload,
} from '../src/lib/catalog/productCatalogStorage'
import {
  clearDataStore,
  getUserDataSnapshot,
  hydrateDataStore,
  updateTrialProgress,
} from '../src/lib/supabase/dataStore'
import type { MergedProduct } from '../src/types'
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

const PAIR_A = {
  liquid: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Dr.Leo Drying Liquid',
    tiktokId: 'tiktok-drying-liquid',
    commission: 12.4,
    itemsSold: 8,
    videosFilmed: 4,
  },
  lotion: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Dr.Leo Drying Lotion',
    tiktokId: 'tiktok-drying-lotion',
    commission: 9.97,
    itemsSold: 2,
    videosFilmed: 6,
  },
}

const PAIR_B = {
  volcanic: {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Dr.Leo Charcoal Volcanic Clay Mask Stick',
    tiktokId: 'tiktok-volcanic-stick',
    commission: 18.29,
    itemsSold: 12,
    videosFilmed: 2,
  },
  vegan: {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Dr.Leo Vegan Charcoal Cleansing Clay Mask Stick',
    tiktokId: 'tiktok-vegan-stick',
    commission: 7.5,
    itemsSold: 5,
    videosFilmed: 5,
  },
}

resetStore()

reconcileCatalogFromCsvUpload([
  csvProduct({
    id: PAIR_A.liquid.id,
    productName: PAIR_A.liquid.name,
    productId: PAIR_A.liquid.tiktokId,
    commission: PAIR_A.liquid.commission,
    itemsSold: PAIR_A.liquid.itemsSold,
    orderCount: 8,
  }),
  csvProduct({
    id: PAIR_A.lotion.id,
    productName: PAIR_A.lotion.name,
    productId: PAIR_A.lotion.tiktokId,
    commission: PAIR_A.lotion.commission,
    itemsSold: PAIR_A.lotion.itemsSold,
    orderCount: 2,
  }),
  csvProduct({
    id: PAIR_B.volcanic.id,
    productName: PAIR_B.volcanic.name,
    productId: PAIR_B.volcanic.tiktokId,
    commission: PAIR_B.volcanic.commission,
    itemsSold: PAIR_B.volcanic.itemsSold,
    orderCount: 12,
  }),
  csvProduct({
    id: PAIR_B.vegan.id,
    productName: PAIR_B.vegan.name,
    productId: PAIR_B.vegan.tiktokId,
    commission: PAIR_B.vegan.commission,
    itemsSold: PAIR_B.vegan.itemsSold,
    orderCount: 5,
  }),
])

updateTrialProgress({
  [PAIR_A.liquid.id]: { videosFilmed: PAIR_A.liquid.videosFilmed, source: 'manual' },
  [PAIR_A.lotion.id]: { videosFilmed: PAIR_A.lotion.videosFilmed, source: 'manual' },
  [PAIR_B.volcanic.id]: { videosFilmed: PAIR_B.volcanic.videosFilmed, source: 'manual' },
  [PAIR_B.vegan.id]: { videosFilmed: PAIR_B.vegan.videosFilmed, source: 'manual' },
})

console.log('='.repeat(64))
console.log('CONFIRM DIALOG COPY — Pair A (Liquid ↔ Lotion)')
console.log('='.repeat(64))

const previewA = previewCatalogProductMerge([PAIR_A.liquid.id, PAIR_A.lotion.id])
const copyA = formatMergeConfirmSummary(previewA)
console.log(`\nTitle: ${copyA.title}\n`)
for (const line of copyA.bodyLines) {
  console.log(`• ${line}`)
}

assert.equal(
  Number(previewA.combinedCommission.toFixed(2)),
  Number((PAIR_A.liquid.commission + PAIR_A.lotion.commission).toFixed(2)),
)
assert.equal(
  previewA.videosFilmedMax,
  Math.max(PAIR_A.liquid.videosFilmed, PAIR_A.lotion.videosFilmed),
)
assert.ok(previewA.linkedExternalIds.includes(PAIR_A.liquid.tiktokId))
assert.ok(previewA.linkedExternalIds.includes(PAIR_A.lotion.tiktokId))

console.log('\n' + '='.repeat(64))
console.log('MERGE Pair A — Dr.Leo Drying Liquid keeps record')
console.log('='.repeat(64))

const recordA = mergeCatalogProducts([PAIR_A.liquid.id, PAIR_A.lotion.id])
let catalog = loadProductCatalog()
const survivorA = catalog.find((p) => p.id === PAIR_A.liquid.id)
const absorbedA = catalog.find((p) => p.id === PAIR_A.lotion.id)

assert.ok(survivorA)
assert.ok(absorbedA?.archivedAt)
assert.equal(Number(survivorA!.commission.toFixed(2)), 22.37)
assert.equal(survivorA!.itemsSold, 10)
assert.equal(survivorA!.orderCount, 10)
assert.deepEqual(
  new Set(survivorA!.linkedExternalIds),
  new Set([PAIR_A.lotion.tiktokId]),
)
assert.equal(survivorA!.externalProductId, PAIR_A.liquid.tiktokId)
assert.equal(recordA.afterTrialVideosFilmed, 6)

const trialAfterA = hydrateTrialCheck(PAIR_A.liquid.id)
assert.equal(trialAfterA, 6)
console.log(
  `Survivor “${survivorA!.displayName}”: $${survivorA!.commission.toFixed(2)} / ${survivorA!.itemsSold} items / videos filmed ${trialAfterA} (max, not sum) ✓`,
)
console.log(
  `Absorbed “${absorbedA!.displayName}” archived; TikTok ID ${PAIR_A.lotion.tiktokId} linked ✓`,
)

console.log('\n' + '='.repeat(64))
console.log('CONFIRM DIALOG COPY — Pair B (Volcanic ↔ Vegan stick)')
console.log('='.repeat(64))

const previewB = previewCatalogProductMerge([PAIR_B.volcanic.id, PAIR_B.vegan.id])
const copyB = formatMergeConfirmSummary(previewB)
console.log(`\nTitle: ${copyB.title}\n`)
for (const line of copyB.bodyLines) {
  console.log(`• ${line}`)
}

console.log('\n' + '='.repeat(64))
console.log('MERGE Pair B — Volcanic Stick keeps record')
console.log('='.repeat(64))

const recordB = mergeCatalogProducts([PAIR_B.volcanic.id, PAIR_B.vegan.id])
catalog = loadProductCatalog()
const survivorB = catalog.find((p) => p.id === PAIR_B.volcanic.id)
const absorbedB = catalog.find((p) => p.id === PAIR_B.vegan.id)

assert.ok(survivorB)
assert.ok(absorbedB?.archivedAt)
assert.equal(Number(survivorB!.commission.toFixed(2)), 25.79)
assert.equal(survivorB!.itemsSold, 17)
assert.equal(recordB.afterTrialVideosFilmed, 5)
assert.deepEqual(
  new Set(survivorB!.linkedExternalIds),
  new Set([PAIR_B.vegan.tiktokId]),
)
assert.equal(hydrateTrialCheck(PAIR_B.volcanic.id), 5)
console.log(
  `Survivor “${survivorB!.displayName}”: $${survivorB!.commission.toFixed(2)} / ${survivorB!.itemsSold} items / videos filmed 5 ✓`,
)
console.log(
  `Absorbed “${absorbedB!.displayName}” archived; TikTok ID ${PAIR_B.vegan.tiktokId} linked ✓`,
)

console.log('\n' + '='.repeat(64))
console.log('FUTURE CSV — both TikTok IDs update the survivor')
console.log('='.repeat(64))

reconcileCatalogFromCsvUpload([
  csvProduct({
    id: 'new-liquid-row',
    productName: PAIR_A.liquid.name,
    productId: PAIR_A.liquid.tiktokId,
    commission: 5,
    itemsSold: 1,
    orderCount: 1,
  }),
  csvProduct({
    id: 'new-lotion-row',
    productName: PAIR_A.lotion.name,
    productId: PAIR_A.lotion.tiktokId,
    commission: 3,
    itemsSold: 1,
    orderCount: 1,
  }),
  csvProduct({
    id: 'new-volcanic-row',
    productName: PAIR_B.volcanic.name,
    productId: PAIR_B.volcanic.tiktokId,
    commission: 10,
    itemsSold: 2,
    orderCount: 2,
  }),
  csvProduct({
    id: 'new-vegan-row',
    productName: PAIR_B.vegan.name,
    productId: PAIR_B.vegan.tiktokId,
    commission: 4,
    itemsSold: 1,
    orderCount: 1,
  }),
])

catalog = loadProductCatalog()
const live = catalog.filter((p) => !p.archivedAt)
assert.equal(live.length, 2, 'only two live survivors after dual-ID CSV')
const liquidLive = live.find((p) => p.id === PAIR_A.liquid.id)!
const volcanicLive = live.find((p) => p.id === PAIR_B.volcanic.id)!
assert.equal(Number(liquidLive.commission.toFixed(2)), 8)
assert.equal(liquidLive.itemsSold, 2)
assert.equal(Number(volcanicLive.commission.toFixed(2)), 14)
assert.equal(volcanicLive.itemsSold, 3)
console.log(
  `Pair A survivor refreshed from BOTH IDs → $${liquidLive.commission.toFixed(2)} / ${liquidLive.itemsSold} items ✓`,
)
console.log(
  `Pair B survivor refreshed from BOTH IDs → $${volcanicLive.commission.toFixed(2)} / ${volcanicLive.itemsSold} items ✓`,
)

console.log('\n' + '='.repeat(64))
console.log('UNDO — latest merge (Pair B) restores absorbed row')
console.log('='.repeat(64))

const latest = latestUndoableMerge()
assert.ok(latest)
assert.equal(latest!.id, recordB.id)
assert.equal(undoCatalogProductMerge(latest!.id), true)

catalog = loadProductCatalog()
const veganRestored = catalog.find((p) => p.id === PAIR_B.vegan.id)
const volcanicRestored = catalog.find((p) => p.id === PAIR_B.volcanic.id)
assert.ok(veganRestored && !veganRestored.archivedAt)
assert.equal(Number(volcanicRestored!.commission.toFixed(2)), PAIR_B.volcanic.commission)
assert.equal(volcanicRestored!.linkedExternalIds.length, 0)
assert.equal(hydrateTrialCheck(PAIR_B.volcanic.id), PAIR_B.volcanic.videosFilmed)
assert.equal(hydrateTrialCheck(PAIR_B.vegan.id), PAIR_B.vegan.videosFilmed)
console.log(`Restored “${veganRestored!.displayName}” as its own live row ✓`)
console.log(
  `Volcanic stick back to $${volcanicRestored!.commission.toFixed(2)} with original trial counts ✓`,
)

// Pair A merge record still undoable
assert.ok(latestUndoableMerge()?.id === recordA.id)

console.log('\nverify-catalog-manual-link: PASS')

function hydrateTrialCheck(productId: string): number {
  return getUserDataSnapshot().trialProgress[productId]?.videosFilmed ?? 0
}

/**
 * Proof: Product Scout → sprint catalog promotion.
 * - Happy path creates manual catalog row at 0 filmed / Test
 * - Marks Scout entry with promotedCatalogProductId + promotedAt
 * - Blocks duplicate name (case-insensitive)
 * - Blocks already-promoted when catalog link is live
 * - Stale promotion link allows re-promote when catalog row is gone
 *
 * Usage: npx tsx scripts/verify-scout-add-to-sprint.ts
 */
import assert from 'node:assert/strict'
import {
  findCatalogProductByName,
  isScoutPromotedToSprint,
  promoteScoutEntryToSprint,
} from '../src/lib/productScout/promoteScoutToSprint'
import {
  clearProductCatalog,
  loadProductCatalog,
  saveProductCatalog,
} from '../src/lib/catalog/productCatalogStorage'
import {
  clearDataStore,
  hydrateDataStore,
} from '../src/lib/supabase/dataStore'
import type { ProductScoutEntry, ProductScoutMetrics } from '../src/types/productScout'
import type { CatalogProduct } from '../src/types/productCatalog'
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

const emptyMetrics: ProductScoutMetrics = {
  orders: { value: '100', delta: '10' },
  ctr: { value: '3', delta: '1' },
  creators: { value: '50', delta: '5' },
  atcUsers: { value: '20', delta: '2' },
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

function scoutEntry(partial: Partial<ProductScoutEntry> & Pick<ProductScoutEntry, 'productName'>): ProductScoutEntry {
  const now = '2026-07-29T12:00:00.000Z'
  return {
    id: partial.id ?? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    productName: partial.productName,
    metrics: partial.metrics ?? emptyMetrics,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    promotedCatalogProductId: partial.promotedCatalogProductId ?? null,
    promotedAt: partial.promotedAt ?? null,
  }
}

function catalogRow(partial: Partial<CatalogProduct> & Pick<CatalogProduct, 'id' | 'displayName'>): CatalogProduct {
  const now = '2026-07-29T12:00:00.000Z'
  return {
    id: partial.id,
    displayName: partial.displayName,
    brand: null,
    externalProductId: null,
    linkedExternalIds: [],
    source: 'manual',
    isFavorite: false,
    gmv: 0,
    commission: 0,
    itemsSold: 0,
    orderCount: 0,
    inRotation: true,
    isManual: true,
    dateReceived: null,
    firstVideoDeadline: null,
    archivedAt: partial.archivedAt ?? null,
    createdAt: now,
    updatedAt: now,
  }
}

resetStore()

// --- Happy path ---
{
  const entry = scoutEntry({ productName: 'Glow Serum Pro' })
  const result = promoteScoutEntryToSprint(entry)
  assert.equal(result.ok, true)
  if (!result.ok) throw new Error('unreachable')
  assert.equal(result.product.productName, 'Glow Serum Pro')
  assert.equal(result.product.videosFilmed, 0)
  assert.equal(result.product.tier, 'Test')
  assert.equal(result.product.isManual, true)
  assert.equal(result.product.productId, 'manual')
  assert.equal(result.scoutPatch.promotedCatalogProductId, result.product.id)
  assert.ok(result.scoutPatch.promotedAt)

  const catalog = loadProductCatalog()
  assert.equal(catalog.length, 1)
  assert.equal(catalog[0]?.displayName, 'Glow Serum Pro')
  assert.equal(catalog[0]?.source, 'manual')
  assert.equal(catalog[0]?.id, result.product.id)

  const marked: ProductScoutEntry = {
    ...entry,
    ...result.scoutPatch,
  }
  assert.equal(isScoutPromotedToSprint(marked), true)
  console.log('✓ happy path: Scout → manual Test @ 0 filmed, Scout marked')
}

resetStore()

// --- Duplicate name (case / whitespace) ---
{
  saveProductCatalog([
    catalogRow({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      displayName: 'Glow Serum Pro',
    }),
  ])
  const entry = scoutEntry({ productName: '  glow serum pro  ' })
  const result = promoteScoutEntryToSprint(entry)
  assert.equal(result.ok, false)
  if (result.ok) throw new Error('unreachable')
  assert.equal(result.reason, 'duplicate_name')
  assert.match(result.message, /already in your sprint catalog/i)
  assert.equal(loadProductCatalog().length, 1)
  assert.equal(findCatalogProductByName('GLOW SERUM PRO')?.id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  console.log('✓ duplicate name blocked (case-insensitive)')
}

resetStore()

// --- Already promoted (live link) ---
{
  const catalogId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  saveProductCatalog([catalogRow({ id: catalogId, displayName: 'Old Name Kept' })])
  const entry = scoutEntry({
    productName: 'Renamed Scout Title',
    promotedCatalogProductId: catalogId,
    promotedAt: '2026-07-01T00:00:00.000Z',
  })
  const result = promoteScoutEntryToSprint(entry)
  assert.equal(result.ok, false)
  if (result.ok) throw new Error('unreachable')
  assert.equal(result.reason, 'already_promoted')
  assert.equal(loadProductCatalog().length, 1)
  console.log('✓ already-promoted blocked even if Scout title changed')
}

resetStore()

// --- Stale promotion link → allow re-promote ---
{
  const entry = scoutEntry({
    productName: 'Comeback Cream',
    promotedCatalogProductId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    promotedAt: '2026-07-01T00:00:00.000Z',
  })
  assert.equal(isScoutPromotedToSprint(entry), false)
  const result = promoteScoutEntryToSprint(entry)
  assert.equal(result.ok, true)
  if (!result.ok) throw new Error('unreachable')
  assert.equal(result.product.productName, 'Comeback Cream')
  assert.equal(loadProductCatalog().length, 1)
  console.log('✓ stale promotion link allows re-promote')
}

resetStore()

// --- Stale + duplicate name → block and flag clearStalePromotion ---
{
  saveProductCatalog([
    catalogRow({
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      displayName: 'Dup Serum',
    }),
  ])
  const entry = scoutEntry({
    productName: 'Dup Serum',
    promotedCatalogProductId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    promotedAt: '2026-07-01T00:00:00.000Z',
  })
  const result = promoteScoutEntryToSprint(entry)
  assert.equal(result.ok, false)
  if (result.ok) throw new Error('unreachable')
  assert.equal(result.reason, 'duplicate_name')
  assert.equal(result.clearStalePromotion, true)
  console.log('✓ stale + duplicate name blocks and requests clearStalePromotion')
}

console.log('\nverify-scout-add-to-sprint: PASS')

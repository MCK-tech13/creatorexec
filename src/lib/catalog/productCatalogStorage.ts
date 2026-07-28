import type { MergedProduct, SampleProduct } from '../../types'
import type { CatalogProduct, CatalogProductSource } from '../../types/productCatalog'
import { getUserDataSnapshot, updateProductCatalog } from '../supabase/dataStore'
import {
  scheduleProductCatalogClear,
  scheduleProductCatalogPersist,
} from '../supabase/sync'

const SENTINEL_EXTERNAL_IDS = new Set(['sample', 'manual', ''])

function nowIso(): string {
  return new Date().toISOString()
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function normalizeExternalProductId(productId: string | null | undefined): string | null {
  if (!productId) return null
  const trimmed = productId.trim()
  if (!trimmed || SENTINEL_EXTERNAL_IDS.has(trimmed)) return null
  return trimmed
}

function withLinkedIds(product: CatalogProduct): CatalogProduct {
  return {
    ...product,
    linkedExternalIds: product.linkedExternalIds ?? [],
  }
}

/** All TikTok IDs that should resolve to this catalog row. */
export function allExternalIdsForProduct(product: CatalogProduct): string[] {
  const ids = [...(product.linkedExternalIds ?? [])]
  if (product.externalProductId) ids.unshift(product.externalProductId)
  return [...new Set(ids.filter(Boolean))]
}

export function findCatalogProductByExternalId(
  products: CatalogProduct[],
  externalId: string | null | undefined,
): CatalogProduct | undefined {
  if (!externalId) return undefined
  return products.find(
    (product) =>
      !product.archivedAt && allExternalIdsForProduct(product).includes(externalId),
  )
}

export function loadProductCatalog(): CatalogProduct[] {
  return getUserDataSnapshot().productCatalog.map(withLinkedIds)
}

export function saveProductCatalog(products: CatalogProduct[]): void {
  updateProductCatalog(products.map(withLinkedIds))
  scheduleProductCatalogPersist()
}

/** Clears in-memory catalog and schedules an explicit DB wipe (onboarding only). */
export function clearProductCatalog(): void {
  updateProductCatalog([])
  scheduleProductCatalogClear()
}

function upsertById(
  existing: CatalogProduct[],
  incoming: CatalogProduct[],
): CatalogProduct[] {
  const live = existing.filter((product) => !product.archivedAt).map(withLinkedIds)
  const archived = existing.filter((product) => product.archivedAt).map(withLinkedIds)
  const byId = new Map(live.map((product) => [product.id, product]))

  for (const product of incoming) {
    const externalMatch = findCatalogProductByExternalId(live, product.externalProductId)
    const prev = externalMatch ?? byId.get(product.id)
    const merged: CatalogProduct = prev
      ? {
          ...prev,
          ...product,
          id: prev.id,
          createdAt: prev.createdAt,
          updatedAt: nowIso(),
          externalProductId: product.externalProductId ?? prev.externalProductId,
          linkedExternalIds: prev.linkedExternalIds ?? [],
          firstVideoDeadline: product.firstVideoDeadline ?? prev.firstVideoDeadline,
          isFavorite: Boolean(prev.isFavorite) || Boolean(product.isFavorite),
        }
      : withLinkedIds(product)
    byId.set(merged.id, merged)
  }
  return [...archived, ...byId.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  )
}

/**
 * Manual / sample rows survive a new commission report even when they have
 * no TikTok ID match yet (still in testing). CSV (and non-manual backfill)
 * rows are report-bound and may be pruned.
 */
export function isProtectedFromCsvPrune(product: CatalogProduct): boolean {
  if (product.isManual) return true
  return product.source === 'manual' || product.source === 'sample'
}

/**
 * Refresh matched rows (including manual links / multi-ID survivors), prune
 * unmatched CSV rows, keep protected manuals/samples and archived merges.
 */
function replaceCsvCatalogRows(
  existing: CatalogProduct[],
  incoming: CatalogProduct[],
): CatalogProduct[] {
  const archived = existing.filter((product) => product.archivedAt).map(withLinkedIds)
  const live = existing.filter((product) => !product.archivedAt).map(withLinkedIds)

  const updates = new Map<string, CatalogProduct>()
  const unmatchedIncoming: CatalogProduct[] = []

  for (const row of incoming) {
    const match =
      findCatalogProductByExternalId(live, row.externalProductId) ??
      live.find((product) => product.id === row.id)

    if (!match) {
      unmatchedIncoming.push(withLinkedIds(row))
      continue
    }

    const prior = updates.get(match.id)
    if (!prior) {
      updates.set(match.id, {
        ...match,
        gmv: row.gmv,
        commission: row.commission,
        itemsSold: row.itemsSold,
        orderCount: row.orderCount,
        updatedAt: nowIso(),
        // Keep manual/sample source when the user linked TikTok IDs onto it.
        source: isProtectedFromCsvPrune(match) ? match.source : 'csv',
        firstVideoDeadline: row.firstVideoDeadline ?? match.firstVideoDeadline,
        isFavorite: Boolean(match.isFavorite) || Boolean(row.isFavorite),
        linkedExternalIds: match.linkedExternalIds ?? [],
        externalProductId: match.externalProductId ?? row.externalProductId,
      })
    } else {
      // Multiple CSV listings mapped to the same linked product → sum this report.
      updates.set(match.id, {
        ...prior,
        gmv: prior.gmv + row.gmv,
        commission: prior.commission + row.commission,
        itemsSold: prior.itemsSold + row.itemsSold,
        orderCount: prior.orderCount + row.orderCount,
        updatedAt: nowIso(),
      })
    }
  }

  const nextLive: CatalogProduct[] = []
  for (const product of live) {
    const updated = updates.get(product.id)
    if (updated) {
      nextLive.push(updated)
      continue
    }
    if (isProtectedFromCsvPrune(product)) {
      nextLive.push(product)
    }
    // Unmatched prior CSV/backfill rows are pruned.
  }

  for (const row of unmatchedIncoming) {
    nextLive.push(row)
  }

  return [...archived, ...nextLive].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  )
}

export function catalogProductFromMerged(
  product: MergedProduct,
  source: CatalogProductSource = product.isManual ? 'manual' : 'csv',
): CatalogProduct {
  const timestamp = nowIso()
  const externalProductId = normalizeExternalProductId(product.productId)
  const id = isUuid(product.id) ? product.id : crypto.randomUUID()
  return {
    id,
    displayName: product.productName,
    brand: null,
    externalProductId,
    linkedExternalIds: [],
    source,
    isFavorite: product.isFavorite ?? false,
    gmv: product.gmv,
    commission: product.commission,
    itemsSold: product.itemsSold,
    orderCount: product.orderCount,
    inRotation: product.inRotation,
    isManual: product.isManual,
    dateReceived: null,
    firstVideoDeadline: product.firstVideoDeadline?.trim()
      ? product.firstVideoDeadline.trim()
      : null,
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function catalogProductFromSample(product: SampleProduct): CatalogProduct {
  const timestamp = nowIso()
  return {
    id: product.id,
    displayName: product.productName,
    brand: product.brand.trim() ? product.brand.trim() : null,
    externalProductId: null,
    linkedExternalIds: [],
    source: 'sample',
    isFavorite: product.type === 'favorite',
    gmv: 0,
    commission: 0,
    itemsSold: 0,
    orderCount: 0,
    inRotation: true,
    isManual: true,
    dateReceived: product.dateReceived || null,
    firstVideoDeadline: product.firstVideoDeadline?.trim()
      ? product.firstVideoDeadline.trim()
      : null,
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** Upsert merged sprint products into the durable catalog (dual-write). */
export function upsertCatalogFromMergedProducts(
  products: MergedProduct[],
  source?: CatalogProductSource,
): CatalogProduct[] {
  if (products.length === 0) return loadProductCatalog()
  const incoming = products.map((product) =>
    catalogProductFromMerged(
      product,
      source ?? (product.isManual ? 'manual' : 'csv'),
    ),
  )
  const next = upsertById(loadProductCatalog(), incoming)
  saveProductCatalog(next)
  return next
}

/**
 * Commission-report reconcile: refresh matched CSV rows from this file and
 * prune CSV-sourced rows that are absent. Manual/sample products are kept.
 * Manually linked TikTok IDs continue to resolve to the survivor row.
 */
export function reconcileCatalogFromCsvUpload(
  products: MergedProduct[],
): CatalogProduct[] {
  const incoming = products.map((product) => catalogProductFromMerged(product, 'csv'))
  const next = replaceCsvCatalogRows(loadProductCatalog(), incoming)
  saveProductCatalog(next)
  return next
}

/** Upsert sample-mode products into the durable catalog (dual-write). */
export function upsertCatalogFromSampleProducts(
  products: SampleProduct[],
): CatalogProduct[] {
  if (products.length === 0) return loadProductCatalog()
  const incoming = products.map(catalogProductFromSample)
  const next = upsertById(loadProductCatalog(), incoming)
  saveProductCatalog(next)
  return next
}

/**
 * One-time (idempotent) backfill: if the catalog is empty and the live sprint
 * has products/samples, copy them into the durable catalog.
 */
export function backfillCatalogFromSprintState(input: {
  products?: MergedProduct[] | null
  sampleProducts?: SampleProduct[] | null
}): { backfilled: boolean; catalog: CatalogProduct[] } {
  const existing = loadProductCatalog()
  if (existing.length > 0) {
    return { backfilled: false, catalog: existing }
  }

  const merged = input.products ?? []
  const samples = input.sampleProducts ?? []
  if (merged.length === 0 && samples.length === 0) {
    return { backfilled: false, catalog: existing }
  }

  const fromMerged = merged.map((product) =>
    catalogProductFromMerged(product, 'backfill'),
  )
  const fromSamples = samples.map((product) => {
    const entry = catalogProductFromSample(product)
    return { ...entry, source: 'backfill' as const }
  })

  const next = upsertById([], [...fromMerged, ...fromSamples])
  saveProductCatalog(next)
  return { backfilled: true, catalog: next }
}

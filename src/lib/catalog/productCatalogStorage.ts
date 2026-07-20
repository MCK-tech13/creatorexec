import type { MergedProduct, SampleProduct } from '../../types'
import type { CatalogProduct, CatalogProductSource } from '../../types/productCatalog'
import { getUserDataSnapshot, updateProductCatalog } from '../supabase/dataStore'
import { scheduleProductCatalogPersist } from '../supabase/sync'

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

export function loadProductCatalog(): CatalogProduct[] {
  return getUserDataSnapshot().productCatalog
}

export function saveProductCatalog(products: CatalogProduct[]): void {
  updateProductCatalog(products)
  scheduleProductCatalogPersist()
}

export function clearProductCatalog(): void {
  saveProductCatalog([])
}

function upsertById(
  existing: CatalogProduct[],
  incoming: CatalogProduct[],
): CatalogProduct[] {
  const byId = new Map(existing.map((product) => [product.id, product]))
  const byExternal = new Map(
    existing
      .filter((product) => product.externalProductId)
      .map((product) => [product.externalProductId as string, product]),
  )

  for (const product of incoming) {
    const externalMatch = product.externalProductId
      ? byExternal.get(product.externalProductId)
      : undefined
    const prev = externalMatch ?? byId.get(product.id)
    const merged: CatalogProduct = prev
      ? {
          ...prev,
          ...product,
          id: prev.id,
          createdAt: prev.createdAt,
          updatedAt: nowIso(),
          // Keep an existing TikTok id if the incoming row lost it.
          externalProductId: product.externalProductId ?? prev.externalProductId,
        }
      : product
    byId.set(merged.id, merged)
    if (merged.externalProductId) {
      byExternal.set(merged.externalProductId, merged)
    }
  }
  return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function catalogProductFromMerged(
  product: MergedProduct,
  source: CatalogProductSource = product.isManual ? 'manual' : 'csv',
): CatalogProduct {
  const timestamp = nowIso()
  const externalProductId = normalizeExternalProductId(product.productId)
  // Prefer stable UUID ids; otherwise mint one (CSV similar-name merges use non-UUID ids).
  const id = isUuid(product.id) ? product.id : crypto.randomUUID()
  return {
    id,
    displayName: product.productName,
    brand: null,
    externalProductId,
    source,
    isFavorite: false,
    gmv: product.gmv,
    commission: product.commission,
    itemsSold: product.itemsSold,
    orderCount: product.orderCount,
    inRotation: product.inRotation,
    isManual: product.isManual,
    dateReceived: null,
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
    source: 'sample',
    isFavorite: product.type === 'favorite',
    gmv: 0,
    commission: 0,
    itemsSold: 0,
    orderCount: 0,
    inRotation: true,
    isManual: true,
    dateReceived: product.dateReceived || null,
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

import type { MergedProduct } from '../../types'
import type { CatalogProduct } from '../../types/productCatalog'
import type { ProductScoutEntry } from '../../types/productScout'
import { computeScore } from '../analysis/tierEngine'
import {
  loadProductCatalog,
  upsertCatalogFromMergedProducts,
} from '../catalog/productCatalogStorage'

export function normalizeProductNameKey(name: string): string {
  return name.trim().toLowerCase()
}

/** Live (non-archived) catalog row with the same display name, case-insensitive. */
export function findCatalogProductByName(
  name: string,
  catalog: CatalogProduct[] = loadProductCatalog(),
): CatalogProduct | undefined {
  const key = normalizeProductNameKey(name)
  if (!key) return undefined
  return catalog.find(
    (product) => !product.archivedAt && normalizeProductNameKey(product.displayName) === key,
  )
}

/** Catalog row still present for a prior promotion link. */
export function findLivePromotedCatalogProduct(
  entry: ProductScoutEntry,
  catalog: CatalogProduct[] = loadProductCatalog(),
): CatalogProduct | undefined {
  const id = entry.promotedCatalogProductId?.trim()
  if (!id) return undefined
  return catalog.find((product) => product.id === id && !product.archivedAt)
}

export function isScoutPromotedToSprint(
  entry: ProductScoutEntry,
  catalog: CatalogProduct[] = loadProductCatalog(),
): boolean {
  return Boolean(findLivePromotedCatalogProduct(entry, catalog))
}

export type PromoteScoutResult =
  | {
      ok: true
      product: MergedProduct
      scoutPatch: Pick<ProductScoutEntry, 'promotedCatalogProductId' | 'promotedAt'>
      message: string
    }
  | {
      ok: false
      reason: 'already_promoted' | 'duplicate_name' | 'empty_name'
      message: string
      existing?: CatalogProduct
      /** When a stale promotion link should be cleared before retry. */
      clearStalePromotion?: boolean
    }

/**
 * Promote a Scout entry into the sprint catalog as a new manual sample
 * (0 videos filmed → standard 6-video Test trial).
 *
 * Does not mutate Scout storage — caller applies `scoutPatch` and refreshes UI.
 * Writes the catalog row via upsert on success.
 */
export function promoteScoutEntryToSprint(
  entry: ProductScoutEntry,
  catalog: CatalogProduct[] = loadProductCatalog(),
): PromoteScoutResult {
  const productName = entry.productName.trim()
  if (!productName) {
    return {
      ok: false,
      reason: 'empty_name',
      message: 'This Scout entry has no product name to add.',
    }
  }

  const livePromoted = findLivePromotedCatalogProduct(entry, catalog)
  if (livePromoted) {
    return {
      ok: false,
      reason: 'already_promoted',
      message: `“${productName}” is already in your sprint catalog.`,
      existing: livePromoted,
    }
  }

  const stalePromotion = Boolean(entry.promotedCatalogProductId?.trim())
  const duplicate = findCatalogProductByName(productName, catalog)
  if (duplicate) {
    return {
      ok: false,
      reason: 'duplicate_name',
      message: `“${duplicate.displayName}” is already in your sprint catalog — not adding a duplicate.`,
      existing: duplicate,
      clearStalePromotion: stalePromotion,
    }
  }

  const now = new Date().toISOString()
  const product: MergedProduct = {
    id: crypto.randomUUID(),
    productName,
    productId: 'manual',
    gmv: 0,
    commission: 0,
    itemsSold: 0,
    orderCount: 0,
    videosFilmed: 0,
    score: computeScore(0, 0, 0),
    tier: 'Test',
    rankInTier: 0,
    inRotation: true,
    isManual: true,
    isFavorite: false,
    firstVideoDeadline: null,
  }

  upsertCatalogFromMergedProducts([product], 'manual')

  return {
    ok: true,
    product,
    scoutPatch: {
      promotedCatalogProductId: product.id,
      promotedAt: now,
    },
    message: `Added “${productName}” to sprint — Test trial starts at 0/6 videos.`,
  }
}

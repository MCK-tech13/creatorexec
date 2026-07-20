import type { MergedProduct } from '../../types'
import type { CatalogProduct } from '../../types/productCatalog'
import { tierProducts } from '../analysis/tierEngine'
import { hydrateProductsTrialProgress } from '../schedule/trialProgress'
import { loadProductCatalog } from './productCatalogStorage'

const SENTINEL_EXTERNAL = new Set(['sample', 'manual', ''])

function displayName(product: CatalogProduct): string {
  return product.brand ? `${product.displayName} (${product.brand})` : product.displayName
}

function externalOrSentinel(product: CatalogProduct): string {
  if (product.externalProductId && !SENTINEL_EXTERNAL.has(product.externalProductId)) {
    return product.externalProductId
  }
  // Keep a sentinel for non-TikTok rows so trialStorageKey prefers catalog UUID.
  return product.isManual || product.source === 'sample' || product.source === 'backfill'
    ? 'sample'
    : 'manual'
}

/** Map a durable catalog row into a pre-tier MergedProduct draft. */
export function mergedDraftFromCatalog(
  product: CatalogProduct,
): Omit<MergedProduct, 'score' | 'tier' | 'rankInTier'> {
  return {
    id: product.id,
    productName: displayName(product),
    productId: externalOrSentinel(product),
    gmv: product.gmv,
    commission: product.commission,
    itemsSold: product.itemsSold,
    orderCount: product.orderCount,
    videosFilmed: 0,
    inRotation: product.inRotation,
    // Force through assignTier so zero-sales land in Test (favorites included).
    isManual: false,
    isFavorite: product.isFavorite,
  }
}

export function activeCatalogProducts(
  catalog: CatalogProduct[] = loadProductCatalog(),
): CatalogProduct[] {
  return catalog.filter((product) => product.inRotation && !product.archivedAt)
}

/**
 * Build the sprint product list from the durable catalog.
 * Zero-metric rows run through tierEngine → Test; favorites stay Test with isFavorite.
 */
export function buildSprintProductsFromCatalog(
  catalog: CatalogProduct[] = loadProductCatalog(),
  options?: { hydrateTrial?: boolean },
): MergedProduct[] {
  const active = activeCatalogProducts(catalog)
  if (active.length === 0) return []

  const byId = new Map(active.map((product) => [product.id, product]))
  const drafts = active.map(mergedDraftFromCatalog)
  const tiered = tierProducts(drafts).map((product) => {
    const source = byId.get(product.id)
    return {
      ...product,
      isManual: source?.isManual ?? product.isManual,
      isFavorite: source?.isFavorite ?? Boolean(product.isFavorite),
    }
  })

  if (options?.hydrateTrial === false) return tiered
  return hydrateProductsTrialProgress(tiered)
}

/** Re-apply catalog favorite flags onto an in-sprint product list. */
export function enrichProductsWithCatalogFavorites(
  products: MergedProduct[],
  catalog: CatalogProduct[] = loadProductCatalog(),
): MergedProduct[] {
  if (products.length === 0 || catalog.length === 0) return products
  const byId = new Map(catalog.map((product) => [product.id, product]))
  return products.map((product) => {
    const match = byId.get(product.id)
    if (!match) return product
    return { ...product, isFavorite: match.isFavorite }
  })
}

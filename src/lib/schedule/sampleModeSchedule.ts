import type { MergedProduct, SampleProduct } from '../../types'

/** Favorites first, then samples by date received (oldest first). */
export function sortSampleProductsForSchedule(products: SampleProduct[]): SampleProduct[] {
  const favorites = products.filter((p) => p.type === 'favorite')
  const samples = products
    .filter((p) => p.type === 'sample')
    .sort(
      (a, b) =>
        new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime(),
    )
  return [...favorites, ...samples]
}

/**
 * Map catalog-add form rows into MergedProduct drafts.
 * Favorites are soft priority flags — they stay Test with zero metrics.
 * Stage 3: scheduling always goes through buildFilmingSchedule / catalog rebuild.
 */
export function sampleProductsToMerged(products: SampleProduct[]): MergedProduct[] {
  return sortSampleProductsForSchedule(products).map((p) => ({
    id: p.id,
    productName: p.brand ? `${p.productName} (${p.brand})` : p.productName,
    productId: 'sample',
    gmv: 0,
    commission: 0,
    itemsSold: 0,
    orderCount: 0,
    videosFilmed: 0,
    score: 0,
    tier: 'Test' as const,
    rankInTier: 0,
    inRotation: true,
    isManual: true,
    isFavorite: p.type === 'favorite',
    firstVideoDeadline: p.firstVideoDeadline?.trim() ? p.firstVideoDeadline.trim() : null,
  }))
}

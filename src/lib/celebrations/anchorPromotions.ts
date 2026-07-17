import type { MergedProduct, Tier } from '../../types'

export interface AnchorPromotion {
  productName: string
  productKey: string
}

function matchKey(product: { id: string; productId: string }): string {
  return product.productId && product.productId !== 'sample' ? product.productId : product.id
}

/**
 * Products that newly became Anchor (not already Anchor before).
 * Skips Momentum Mode results (no Anchor tier there).
 */
export function findAnchorPromotions(
  previous: MergedProduct[],
  next: MergedProduct[],
): AnchorPromotion[] {
  if (previous.length === 0 || next.length === 0) return []

  const prevByKey = new Map<string, Tier>()
  for (const product of previous) {
    prevByKey.set(matchKey(product), product.tier)
  }

  const promotions: AnchorPromotion[] = []
  const seen = new Set<string>()

  for (const product of next) {
    if (product.tier !== 'Anchor') continue
    const key = matchKey(product)
    if (seen.has(key)) continue
    seen.add(key)

    const previousTier = prevByKey.get(key)
    if (previousTier === undefined) continue
    if (previousTier === 'Anchor') continue

    promotions.push({
      productName: product.productName,
      productKey: key,
    })
  }

  return promotions
}

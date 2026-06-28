import type { MergedProduct, RawOrderRow } from '../../types'

interface ProductAccumulator {
  id: string
  productName: string
  productId: string
  gmv: number
  itemsSold: number
  orderCount: number
  estStandardCommission: number
  estShopAdsCommission: number
}

type AggregatedProduct = Omit<MergedProduct, 'score' | 'tier' | 'rankInTier'> & {
  tier?: MergedProduct['tier']
}

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'for',
  'with',
  'and',
  'by',
  'of',
  'in',
  'to',
  'at',
  'from',
  'or',
])

function groupKey(row: RawOrderRow): string {
  return `${row.productId}::${row.productName}`
}

function orderCommission(order: RawOrderRow): number {
  return order.estStandardCommission + order.estShopAdsCommission
}

function toProduct(acc: ProductAccumulator): AggregatedProduct {
  return {
    id: acc.id,
    productName: acc.productName,
    productId: acc.productId,
    gmv: acc.gmv,
    itemsSold: acc.itemsSold,
    orderCount: acc.orderCount,
    videosFilmed: 0,
    commission: acc.estStandardCommission + acc.estShopAdsCommission,
    inRotation: true,
    isManual: false,
  }
}

/** Strip promotional prefix blocks like [SALE], 【Buy 3 Get 1 Free】, (NEW) from the start of a name. */
export function stripLeadingBrackets(name: string): string {
  const leadingBlock =
    /^\s*(?:\[[^\]]*\]|【[^】]*】|\([^)]*\))\s*/

  let result = name.trim()
  while (leadingBlock.test(result)) {
    result = result.replace(leadingBlock, '').trim()
  }
  return result
}

/** Strip promo prefixes, then replace commas with spaces so "Bundle,Painless" tokenizes correctly. */
export function preprocessNameForMerge(name: string): string {
  return stripLeadingBrackets(name).replace(/,/g, ' ')
}

/** Collapse special characters within a token (e.g. Z:SEA → zsea, 2-pack → 2pack). */
export function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function extractSignificantWords(name: string): string[] {
  const preprocessed = preprocessNameForMerge(name)
  return preprocessed
    .split(/\s+/)
    .map(normalizeToken)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word))
}

/** First 3 significant words; brand codes with special chars (e.g. Z:SEA) merge on brand token alone. */
export function getSignificantWordsMergeKey(name: string): string {
  const preprocessed = preprocessNameForMerge(name)
  const rawFirstToken = preprocessed.split(/\s+/)[0] ?? ''
  const words = extractSignificantWords(name)

  if (words.length === 0) {
    return normalizeToken(preprocessed) || name.toLowerCase().trim()
  }

  const brandHadSpecialChars = /[^a-zA-Z0-9]/.test(rawFirstToken)
  const brandToken = words[0]

  if (
    brandHadSpecialChars &&
    brandToken.length >= 2 &&
    brandToken.length <= 8 &&
    /^[a-z0-9]+$/.test(brandToken)
  ) {
    return brandToken
  }

  return words.slice(0, 3).join('|')
}

function pickShorterProduct(
  current: AggregatedProduct,
  candidate: AggregatedProduct,
): AggregatedProduct {
  return candidate.productName.length < current.productName.length ? candidate : current
}

/** Second pass: merge products sharing the same significant-word merge key (different Product IDs). */
export function mergeBySimilarName(products: AggregatedProduct[]): AggregatedProduct[] {
  const groups = new Map<string, AggregatedProduct>()

  for (const product of products) {
    const mergeKey = getSignificantWordsMergeKey(product.productName)

    const existing = groups.get(mergeKey)

    if (existing) {
      const display = pickShorterProduct(existing, product)
      groups.set(mergeKey, {
        id: `name:${mergeKey}`,
        productName: display.productName,
        productId: display.productId,
        gmv: existing.gmv + product.gmv,
        itemsSold: existing.itemsSold + product.itemsSold,
        commission: existing.commission + product.commission,
        orderCount: existing.orderCount + product.orderCount,
        videosFilmed: Math.max(existing.videosFilmed, product.videosFilmed),
        inRotation: existing.inRotation && product.inRotation,
        isManual: existing.isManual || product.isManual,
      })
    } else {
      groups.set(mergeKey, { ...product, id: `name:${mergeKey}` })
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.commission - a.commission)
}

export function aggregateOrdersByProduct(orders: RawOrderRow[]): AggregatedProduct[] {
  const groups = new Map<string, ProductAccumulator>()

  for (const order of orders) {
    const key = groupKey(order)
    const existing = groups.get(key)

    if (existing) {
      existing.gmv += order.gmv
      existing.itemsSold += order.itemsSold
      existing.estStandardCommission += order.estStandardCommission
      existing.estShopAdsCommission += order.estShopAdsCommission
      existing.orderCount += 1
    } else {
      groups.set(key, {
        id: key,
        productName: order.productName,
        productId: order.productId,
        gmv: order.gmv,
        itemsSold: order.itemsSold,
        estStandardCommission: order.estStandardCommission,
        estShopAdsCommission: order.estShopAdsCommission,
        orderCount: 1,
      })
    }
  }

  const byProductId = Array.from(groups.values()).map(toProduct)
  return mergeBySimilarName(byProductId)
}

export { orderCommission }

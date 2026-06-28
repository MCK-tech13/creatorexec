import type { MergedProduct, Tier } from '../../types'

const ANCHOR_MIN_COMMISSION = 5
const ANCHOR_MIN_ITEMS = 5
const TEST_MAX_ITEMS = 2
const MIN_VIDEOS_FOR_CUT = 6
const CUT_PERCENTILE = 0.25
const ANCHOR_PERCENTILE = 0.75

export function computeScore(commission: number, gmv: number, itemsSold: number): number {
  return commission * 0.5 + gmv * 0.25 + itemsSold * 0.25
}

function percentileThreshold(scores: number[], percentile: number): number {
  if (scores.length === 0) return 0
  const sorted = [...scores].sort((a, b) => a - b)
  const idx = Math.floor(percentile * (sorted.length - 1))
  return sorted[idx]
}

function assignTier(
  product: {
    score: number
    commission: number
    itemsSold: number
    videosFilmed: number
  },
  cutThreshold: number,
  anchorThreshold: number,
): Tier {
  if (product.itemsSold <= TEST_MAX_ITEMS) return 'Test'

  if (product.score <= cutThreshold) {
    return product.videosFilmed >= MIN_VIDEOS_FOR_CUT ? 'Cut' : 'Test'
  }

  if (
    product.score >= anchorThreshold &&
    product.commission >= ANCHOR_MIN_COMMISSION &&
    product.itemsSold >= ANCHOR_MIN_ITEMS
  ) {
    return 'Anchor'
  }

  return 'Rising'
}

type TierInput = Omit<MergedProduct, 'score' | 'tier' | 'rankInTier'> & {
  tier?: Tier
}

export function tierProducts(products: TierInput[]): MergedProduct[] {
  const manualProducts = products.filter((p) => p.isManual)
  const autoProducts = products.filter((p) => !p.isManual)

  const withScores = autoProducts.map((p) => ({
    ...p,
    videosFilmed: p.videosFilmed ?? 0,
    score: computeScore(p.commission, p.gmv, p.itemsSold),
  }))

  const eligible = withScores.filter((p) => p.itemsSold > TEST_MAX_ITEMS)
  const scores = eligible.map((p) => p.score)
  const cutThreshold = percentileThreshold(scores, CUT_PERCENTILE)
  const anchorThreshold = percentileThreshold(scores, ANCHOR_PERCENTILE)

  const tiered: MergedProduct[] = withScores.map((p) => ({
    ...p,
    tier: assignTier(p, cutThreshold, anchorThreshold),
    rankInTier: 0,
  }))

  const tiers: Tier[] = ['Anchor', 'Rising', 'Test', 'Cut']

  const manualTiered: MergedProduct[] = manualProducts.map((p) => ({
    ...p,
    videosFilmed: p.videosFilmed ?? 0,
    score: computeScore(p.commission, p.gmv, p.itemsSold),
    tier: p.tier ?? 'Test',
    rankInTier: 0,
  }))

  const combined = [...tiered, ...manualTiered]

  for (const tier of tiers) {
    const inTier = combined
      .filter((p) => p.tier === tier)
      .sort((a, b) => b.score - a.score)
    inTier.forEach((p, i) => {
      p.rankInTier = i + 1
    })
  }

  return combined.sort((a, b) => b.score - a.score)
}

export { MIN_VIDEOS_FOR_CUT }

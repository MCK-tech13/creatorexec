import type { MergedProduct, SprintDays, Tier } from '../../types'
import { computeScore, tierProducts } from './tierEngine'
import {
  tierProductsSopList,
  type TierProductsSopOptions,
} from './sopTierAssign'

export const MOMENTUM_MIN_ITEMS_SOLD = 3
export const MOMENTUM_QUALIFYING_PRODUCT_COUNT = 5

type TierInput = Omit<MergedProduct, 'score' | 'tier' | 'rankInTier'> & {
  tier?: Tier
}

/** Fewer than 5 products with 3+ items sold → suggest Momentum Mode. */
export function shouldSuggestMomentumMode(products: MergedProduct[]): boolean {
  const qualifying = products.filter(
    (p) => !p.isManual && p.itemsSold >= MOMENTUM_MIN_ITEMS_SOLD,
  )
  return qualifying.length < MOMENTUM_QUALIFYING_PRODUCT_COUNT
}

function assignMomentumTier(itemsSold: number): 'Rising' | 'Test' {
  return itemsSold >= MOMENTUM_MIN_ITEMS_SOLD ? 'Rising' : 'Test'
}

/** No Anchor or Cut — 3+ sales → Rising, else Test. */
export function tierProductsMomentum(products: TierInput[]): MergedProduct[] {
  const manualProducts = products.filter((p) => p.isManual)
  const autoProducts = products.filter((p) => !p.isManual)

  const tiered: MergedProduct[] = autoProducts.map((p) => ({
    ...p,
    videosFilmed: p.videosFilmed ?? 0,
    score: computeScore(p.commission, p.gmv, p.itemsSold),
    tier: assignMomentumTier(p.itemsSold),
    rankInTier: 0,
  }))

  const manualTiered: MergedProduct[] = manualProducts.map((p) => ({
    ...p,
    videosFilmed: p.videosFilmed ?? 0,
    score: computeScore(p.commission, p.gmv, p.itemsSold),
    tier: p.tier === 'Anchor' ? 'Rising' : (p.tier ?? assignMomentumTier(p.itemsSold)),
    rankInTier: 0,
  }))

  const combined = [...tiered, ...manualTiered]
  const tiers: Array<'Rising' | 'Test'> = ['Rising', 'Test']

  for (const tier of tiers) {
    const inTier = combined
      .filter((p) => p.tier === tier)
      .sort((a, b) => b.commission - a.commission)
    inTier.forEach((p, i) => {
      p.rankInTier = i + 1
    })
  }

  return combined.sort((a, b) => b.commission - a.commission)
}

export function getTopEarner(
  products: MergedProduct[],
): { name: string; commission: number } | null {
  if (products.length === 0) return null
  const top = products.reduce((best, p) => (p.commission > best.commission ? p : best))
  if (top.commission <= 0) return null
  return { name: top.productName, commission: top.commission }
}

export function formatTopEarnerLine(products: MergedProduct[]): string | null {
  const top = getTopEarner(products)
  if (!top) return null
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(top.commission)
  return `Your top earner so far: ${top.name} with ${amount} in commission.`
}

export function retierProductsForMode(
  products: MergedProduct[],
  mode: 'full' | 'momentum' | 'sop',
  options?: {
    dailyVolume?: number
    sprintDays?: SprintDays
    floors?: TierProductsSopOptions['floors']
  },
): MergedProduct[] {
  const inputs: TierInput[] = products.map((p) => {
    if (p.isManual) {
      return { ...p }
    }
    const { score: _score, tier: _tier, rankInTier: _rankInTier, sopTier: _sopTier, sopBand: _sopBand, ...rest } = p
    return rest
  })
  if (mode === 'momentum') {
    return tierProductsMomentum(inputs)
  }
  if (mode === 'sop') {
    return tierProductsSopList(inputs, {
      dailyVolume: options?.dailyVolume ?? 30,
      sprintDays: options?.sprintDays ?? 3,
      floors: options?.floors,
    })
  }
  return tierProducts(inputs)
}

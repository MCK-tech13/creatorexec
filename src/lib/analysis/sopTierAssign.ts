/**
 * SOP tier assignment from Sales Report (CSV) aggregates.
 *
 * Live rankings only — Top 10 (Anchor/Rotator) + Mid from commission rank;
 * Band A/B / Retired / New Sample / Urgent from videos + deadlines + thresholds.
 * Does not modify tierEngine.ts.
 */
import type { MergedProduct, SopBand, SopTier, SprintDays, Tier } from '../../types'
import { computeScore } from './tierEngine'
import {
  computeSopScaling,
  SOP_COMMISSION_PER_ITEM_MIN,
  SOP_HIGH_TICKET_COMMISSION_PER_ITEM,
  type SopBandFloorSettings,
  type SopScalingResult,
} from './sopTierEngine'

export type { SopTier, SopBand }

/** Full-test completion count from the SOP (6-video rule). */
export const SOP_FULL_TEST_VIDEOS = 6

/** Urgent = 0 videos filmed + hard deadline within this many days. */
export const SOP_URGENT_DEADLINE_DAYS = 4

/** Pull rank N+1 into Anchor when within this fraction of the last Anchor's commission. */
export const SOP_ANCHOR_TIE_RATIO = 0.9

export type SopTierInput = Omit<
  MergedProduct,
  'score' | 'tier' | 'rankInTier' | 'sopTier' | 'sopBand'
> & {
  tier?: Tier
  sopTier?: SopTier
  sopBand?: SopBand | null
}

export interface TierProductsSopOptions {
  dailyVolume: number
  sprintDays: SprintDays
  /** Defaults to "today" (UTC date). */
  asOfDate?: Date
  floors?: Partial<SopBandFloorSettings>
}

export interface SopTierAssignmentMeta {
  scaling: SopScalingResult
  /** True when rank (anchorCount+1) was pulled into Anchor (~10% tie). */
  anchorTieExpanded: boolean
  anchorCount: number
  rotatorCount: number
  midCount: number
  /** Band B list for SOP Step 5 verification (highest commission first). */
  bandBVerification: Array<{
    rank: number
    productName: string
    commission: number
    commissionPerItem: number
    videosFilmed: number
  }>
}

function commissionPerItem(commission: number, itemsSold: number): number {
  if (itemsSold <= 0) return 0
  return commission / itemsSold
}

export function hasSopHighTicketOverride(commission: number, itemsSold: number): boolean {
  return (
    itemsSold >= 1 &&
    commissionPerItem(commission, itemsSold) >= SOP_HIGH_TICKET_COMMISSION_PER_ITEM
  )
}

export function meetsSopPerItemCondition(commission: number, itemsSold: number): boolean {
  return (
    commissionPerItem(commission, itemsSold) >= SOP_COMMISSION_PER_ITEM_MIN ||
    hasSopHighTicketOverride(commission, itemsSold)
  )
}

/**
 * Map SOP backend rank → visible dashboard Tier (Anchor / Rising / Test / Cut).
 * Band A/B collapse to Test; scheduling still reads sopBand / sopTier.
 */
export function sopTierToLegacyTier(sopTier: SopTier): Tier {
  switch (sopTier) {
    case 'Anchor':
      return 'Anchor'
    case 'Rotator':
    case 'Mid':
      return 'Rising'
    case 'BandA':
    case 'BandB':
    case 'NewSample':
    case 'Urgent':
      return 'Test'
    case 'Retired':
      return 'Cut'
  }
}

/**
 * Band metadata for PR 4 scheduling.
 * Only BandA/BandB (visible Test, post–Full-Test-Complete) — never Rising/Anchor.
 */
export function sopBandFromSopTier(sopTier: SopTier): SopBand | null {
  if (sopTier === 'BandA') return 'A'
  if (sopTier === 'BandB') return 'B'
  return null
}

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function isSopUrgentSample(
  product: Pick<SopTierInput, 'videosFilmed' | 'firstVideoDeadline'>,
  asOfDate: Date = new Date(),
): boolean {
  const filmed = product.videosFilmed ?? 0
  if (filmed > 0) return false
  const raw = product.firstVideoDeadline
  if (!raw) return false
  const deadline = new Date(raw)
  if (Number.isNaN(deadline.getTime())) return false
  const days =
    (startOfUtcDay(deadline) - startOfUtcDay(asOfDate)) / (24 * 60 * 60 * 1000)
  return days >= 0 && days <= SOP_URGENT_DEADLINE_DAYS
}

/**
 * Band A / Band B / Retired for Full Test Complete products outside Top/Mid.
 * High-ticket override (≥$10/item, ≥1 sale) qualifies for Band B minimum even
 * when total commission is below the Band B sprint threshold.
 */
export function assignSopWinnerBand(
  product: Pick<SopTierInput, 'commission' | 'itemsSold' | 'videosFilmed'>,
  thresholds: { sprintBandAThreshold: number; sprintBandBThreshold: number },
): 'BandA' | 'BandB' | 'Retired' | null {
  const filmed = product.videosFilmed ?? 0
  if (filmed < SOP_FULL_TEST_VIDEOS) return null

  const c = product.commission
  const items = product.itemsSold
  const perItemOk = meetsSopPerItemCondition(c, items)
  const highTicket = hasSopHighTicketOverride(c, items)

  if (items <= 0) return 'Retired'

  if (c >= thresholds.sprintBandAThreshold && perItemOk) {
    return 'BandA'
  }

  if (
    c >= thresholds.sprintBandBThreshold &&
    c < thresholds.sprintBandAThreshold &&
    perItemOk
  ) {
    return 'BandB'
  }

  // Below Band B total but high-ticket → Band B minimum.
  if (highTicket && c < thresholds.sprintBandAThreshold) {
    return 'BandB'
  }

  return 'Retired'
}

function compareCommissionDesc(
  a: { commission: number; productName: string },
  b: { commission: number; productName: string },
): number {
  if (b.commission !== a.commission) return b.commission - a.commission
  return a.productName.localeCompare(b.productName)
}

export function tierProductsSop(
  products: SopTierInput[],
  options: TierProductsSopOptions,
): { products: MergedProduct[]; meta: SopTierAssignmentMeta } {
  const asOfDate = options.asOfDate ?? new Date()
  const scaling = computeSopScaling({
    dailyVolume: options.dailyVolume,
    sprintDays: options.sprintDays,
    floors: options.floors,
  })

  let anchorCount = scaling.products.anchorProductCount
  let rotatorCount = scaling.products.rotatorProductCount
  const midCount = scaling.products.midProductCount

  const manualProducts = products.filter((p) => p.isManual)
  const autoProducts = products.filter((p) => !p.isManual)

  const ranked = [...autoProducts].sort(compareCommissionDesc)

  let anchorTieExpanded = false
  // Optional guardrail: if next rank after Anchors is within ~10% of last Anchor, pull up.
  if (
    anchorCount >= 1 &&
    ranked.length > anchorCount &&
    ranked[anchorCount - 1].commission > 0
  ) {
    const lastAnchor = ranked[anchorCount - 1]
    const challenger = ranked[anchorCount]
    if (
      challenger &&
      challenger.commission / lastAnchor.commission >= SOP_ANCHOR_TIE_RATIO
    ) {
      anchorCount += 1
      rotatorCount = Math.max(0, rotatorCount - 1)
      anchorTieExpanded = true
    }
  }

  const topMidEnd = anchorCount + rotatorCount + midCount
  const assignment = new Map<string, SopTier>()

  ranked.forEach((p, index) => {
    const rank = index + 1
    if (rank <= anchorCount) {
      assignment.set(p.id, 'Anchor')
      return
    }
    if (rank <= anchorCount + rotatorCount) {
      assignment.set(p.id, 'Rotator')
      return
    }
    if (rank <= topMidEnd) {
      assignment.set(p.id, 'Mid')
      return
    }

    // Outside Top/Mid — winners / urgent / new sample / retired
    if (isSopUrgentSample(p, asOfDate)) {
      assignment.set(p.id, 'Urgent')
      return
    }

    const band = assignSopWinnerBand(p, scaling.bands)
    if (band) {
      assignment.set(p.id, band)
      return
    }

    assignment.set(p.id, 'NewSample')
  })

  const tiered: MergedProduct[] = autoProducts.map((p) => {
    const sopTier = assignment.get(p.id) ?? 'NewSample'
    const videosFilmed = p.videosFilmed ?? 0
    return {
      ...p,
      videosFilmed,
      score: computeScore(p.commission, p.gmv, p.itemsSold),
      sopTier,
      sopBand: sopBandFromSopTier(sopTier),
      tier: sopTierToLegacyTier(sopTier),
      rankInTier: 0,
    }
  })

  const manualTiered: MergedProduct[] = manualProducts.map((p) => {
    const videosFilmed = p.videosFilmed ?? 0
    const sopTier: SopTier = p.sopTier ?? 'NewSample'
    return {
      ...p,
      videosFilmed,
      score: computeScore(p.commission, p.gmv, p.itemsSold),
      sopTier,
      sopBand: p.sopBand ?? sopBandFromSopTier(sopTier),
      tier: sopTierToLegacyTier(sopTier),
      rankInTier: 0,
    }
  })

  const combined = [...tiered, ...manualTiered]
  const sopOrder: SopTier[] = [
    'Anchor',
    'Rotator',
    'Mid',
    'BandA',
    'BandB',
    'Urgent',
    'NewSample',
    'Retired',
  ]

  for (const sop of sopOrder) {
    const inTier = combined
      .filter((p) => p.sopTier === sop)
      .sort(compareCommissionDesc)
    inTier.forEach((p, i) => {
      p.rankInTier = i + 1
    })
  }

  const bandBVerification = combined
    .filter((p) => p.sopTier === 'BandB')
    .sort(compareCommissionDesc)
    .map((p, i) => ({
      rank: i + 1,
      productName: p.productName,
      commission: p.commission,
      commissionPerItem: commissionPerItem(p.commission, p.itemsSold),
      videosFilmed: p.videosFilmed,
    }))

  return {
    products: combined.sort(compareCommissionDesc),
    meta: {
      scaling,
      anchorTieExpanded,
      anchorCount,
      rotatorCount,
      midCount,
      bandBVerification,
    },
  }
}

/** Convenience: products only (for retier plumbing). */
export function tierProductsSopList(
  products: SopTierInput[],
  options: TierProductsSopOptions,
): MergedProduct[] {
  return tierProductsSop(products, options).products
}

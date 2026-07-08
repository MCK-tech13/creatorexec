import { TIER_REVIEW_VIDEO_COUNT } from '../../types'
import { formatDeadlineCountdown } from './deadlineUtils'

export function topSellerDailyReason(): string {
  return 'Top seller — daily rotation'
}

export function provenPerformerReason(timesThisWeek: number): string {
  const count = Math.max(1, timesThisWeek)
  return `Proven performer — ${count}x this week`
}

export function trialVideoReason(current: number, total = TIER_REVIEW_VIDEO_COUNT): string {
  const index = Math.min(Math.max(1, current), total)
  return `Trial video ${index} of ${total}`
}

export function trialVideoRangeReason(start: number, end: number, total = TIER_REVIEW_VIDEO_COUNT): string {
  const safeStart = Math.min(Math.max(1, start), total)
  const safeEnd = Math.min(Math.max(safeStart, end), total)
  if (safeStart === safeEnd) return trialVideoReason(safeStart, total)
  return `Trial videos ${safeStart}–${safeEnd} of ${total}`
}

export function coldStartReason(): string {
  return 'Building sales history — early testing phase'
}

export function retainerReason(brandName: string, deadlineDate?: string): string {
  if (deadlineDate) {
    const days = formatDeadlineCountdown(deadlineDate)
    return `Retainer deal — ${brandName}, ${days.toLowerCase()}`
  }
  return 'Retainer deliverable'
}

export function deadlineReason(deadlineDate?: string): string {
  if (deadlineDate) {
    return `Sample deadline — ${formatDeadlineCountdown(deadlineDate).toLowerCase()}`
  }
  return 'Sample / deadline — film ASAP'
}

export function weeklySlotsFromAllocation(slotsInSprint: number, sprintDays: number): number {
  if (slotsInSprint <= 0) return 0
  if (sprintDays <= 0) return slotsInSprint
  if (sprintDays === 7) return slotsInSprint
  return Math.max(1, Math.round((slotsInSprint / sprintDays) * 7))
}

export function mergePlacementReasons(reasons: string[]): string {
  const unique = [...new Set(reasons.filter(Boolean))]
  if (unique.length === 0) return ''
  if (unique.length === 1) return unique[0]

  const trialNumbers = unique
    .map((reason) => /^Trial video (\d+) of (\d+)$/.exec(reason))
    .filter((match): match is RegExpExecArray => match != null)
    .map((match) => parseInt(match[1], 10))

  if (trialNumbers.length === unique.length && trialNumbers.length > 1) {
    const total = parseInt(/^Trial video \d+ of (\d+)$/.exec(unique[0])?.[1] ?? '6', 10)
    return trialVideoRangeReason(Math.min(...trialNumbers), Math.max(...trialNumbers), total)
  }

  return unique[0]
}

export type SchedulePlacementMode = 'full' | 'momentum' | 'sample'

export interface PlacementReasonContext {
  mode: SchedulePlacementMode
  topAnchorIds: Set<string>
  provenSlotsByProduct: Map<string, number>
  sprintDays: number
}

export function createPlacementReasonBuilder(ctx: PlacementReasonContext) {
  return {
    forTopAnchor(): string {
      return topSellerDailyReason()
    },

    forProven(productId: string): string {
      const slots = ctx.provenSlotsByProduct.get(productId) ?? 0
      const weekly = weeklySlotsFromAllocation(slots, ctx.sprintDays)
      return provenPerformerReason(weekly)
    },

    forTestSlot(videosFilmed: number, alreadyPlacedInSprint: number): string {
      return trialVideoReason(videosFilmed + alreadyPlacedInSprint + 1)
    },

    forTierPlacement(
      productId: string,
      tier: 'Anchor' | 'Rising' | 'Test',
      videosFilmed: number,
      alreadyPlacedInSprint: number,
      kind: 'proven' | 'remaining' | 'fill',
    ): string {
      if (ctx.mode === 'momentum' && tier === 'Rising') {
        return coldStartReason()
      }
      if (ctx.mode === 'sample') {
        return tier === 'Test'
          ? trialVideoReason(videosFilmed + alreadyPlacedInSprint + 1)
          : coldStartReason()
      }
      if (ctx.topAnchorIds.has(productId) && tier === 'Anchor' && kind !== 'fill') {
        return topSellerDailyReason()
      }
      if (tier === 'Test') {
        return trialVideoReason(videosFilmed + alreadyPlacedInSprint + 1)
      }
      if (ctx.provenSlotsByProduct.has(productId) && kind !== 'fill') {
        const slots = ctx.provenSlotsByProduct.get(productId) ?? 0
        return provenPerformerReason(weeklySlotsFromAllocation(slots, ctx.sprintDays))
      }
      if (tier === 'Rising' || tier === 'Anchor') {
        const slots = ctx.provenSlotsByProduct.get(productId) ?? 0
        return provenPerformerReason(Math.max(1, weeklySlotsFromAllocation(slots, ctx.sprintDays)))
      }
      return coldStartReason()
    },
  }
}

export type PlacementReasonBuilder = ReturnType<typeof createPlacementReasonBuilder>

export function buildProvenSlotsMap(
  allocations: { product: { id: string }; slots: number }[],
): Map<string, number> {
  return new Map(allocations.map((row) => [row.product.id, row.slots]))
}

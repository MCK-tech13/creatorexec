import type { BrandDeal } from '../../../types/pipeline'
import { countVideosCompleted, isActiveRetainer } from '../retainerUtils'
import type { CaptionMatchConfidence, CaptionMatchSuggestion, CaptionPost } from './types'

const MIN_TOKEN_LEN = 3

export function normalizeMatchText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[#@]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function significantWords(normalized: string): string[] {
  return normalized.split(' ').filter((w) => w.length >= MIN_TOKEN_LEN)
}

interface ScoredHit {
  deal: BrandDeal
  confidence: CaptionMatchConfidence
  matchedOn: CaptionMatchSuggestion['matchedOn']
}

function scoreDealAgainstCaption(deal: BrandDeal, captionNorm: string): ScoredHit | null {
  const brandNorm = normalizeMatchText(deal.brandName)
  const productNorm = normalizeMatchText(deal.product || '')

  if (brandNorm.length >= MIN_TOKEN_LEN && captionNorm.includes(brandNorm)) {
    return { deal, confidence: 'high', matchedOn: 'brand' }
  }
  if (productNorm.length >= MIN_TOKEN_LEN && captionNorm.includes(productNorm)) {
    return { deal, confidence: 'high', matchedOn: 'product' }
  }

  const brandWords = significantWords(brandNorm)
  if (
    brandWords.length >= 2 &&
    brandWords.every((w) => captionNorm.split(' ').includes(w) || captionNorm.includes(w))
  ) {
    return { deal, confidence: 'medium', matchedOn: 'brand_words' }
  }

  return null
}

/** Retainers that still count for brand ambiguity (including fully filmed / closed). */
function isMatchableRetainer(deal: BrandDeal): boolean {
  return deal.isRetainer === true
}

function dealHasRemainingSlots(deal: BrandDeal): boolean {
  const total = deal.retainerTotalVideos ?? 0
  if (total <= 0) return false
  return countVideosCompleted(deal) < total
}

/**
 * Build unambiguous caption→deal suggestions.
 * - Ambiguity is scored against ALL retainer deals (including completed checklists),
 *   so a caption naming two brands is never treated as a single-brand hit just
 *   because one deal is already fully filmed.
 * - A suggestion is only emitted when exactly one retainer matches AND that deal
 *   is still an active retainer with remaining checklist slots.
 * - Newest caption first among remaining
 */
export function buildCaptionMatchSuggestions(
  captions: CaptionPost[],
  deals: BrandDeal[],
  options?: { dismissedIds?: Set<string>; confirmedCaptionIds?: Set<string> },
): CaptionMatchSuggestion[] {
  const matchable = deals.filter(isMatchableRetainer)
  const dismissed = options?.dismissedIds ?? new Set<string>()
  const confirmed = options?.confirmedCaptionIds ?? new Set<string>()

  const sorted = [...captions].sort((a, b) => b.postedAt.localeCompare(a.postedAt))
  const out: CaptionMatchSuggestion[] = []

  for (const post of sorted) {
    if (confirmed.has(post.id)) continue
    const captionNorm = normalizeMatchText(post.caption)
    if (!captionNorm) continue

    // Ambiguity gate: every retainer brand/product hit counts, even if fully filmed.
    const hits: ScoredHit[] = []
    for (const deal of matchable) {
      const hit = scoreDealAgainstCaption(deal, captionNorm)
      if (hit) hits.push(hit)
    }

    if (hits.length !== 1) continue

    const hit = hits[0]
    // Emission gate: only propose if that single deal can still accept a filmed mark.
    if (!isActiveRetainer(hit.deal) || !dealHasRemainingSlots(hit.deal)) continue

    const suggestionId = `${post.id}::${hit.deal.id}`
    if (dismissed.has(suggestionId)) continue

    out.push({
      id: suggestionId,
      captionPostId: post.id,
      caption: post.caption,
      postedAt: post.postedAt,
      dealId: hit.deal.id,
      brandName: hit.deal.brandName,
      product: hit.deal.product,
      confidence: hit.confidence,
      matchedOn: hit.matchedOn,
    })
  }

  return out
}

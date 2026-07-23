import type { BrandDeal } from '../../../types/pipeline'
import { isActiveRetainer } from '../retainerUtils'
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

/**
 * Build unambiguous caption→deal suggestions.
 * - Skips captions with 0 hits
 * - Skips captions that hit 2+ active deals (ambiguous — safer for demo)
 * - Newest caption first among remaining
 */
export function buildCaptionMatchSuggestions(
  captions: CaptionPost[],
  deals: BrandDeal[],
  options?: { dismissedIds?: Set<string>; confirmedCaptionIds?: Set<string> },
): CaptionMatchSuggestion[] {
  const active = deals.filter(isActiveRetainer)
  const dismissed = options?.dismissedIds ?? new Set<string>()
  const confirmed = options?.confirmedCaptionIds ?? new Set<string>()

  const sorted = [...captions].sort((a, b) => b.postedAt.localeCompare(a.postedAt))
  const out: CaptionMatchSuggestion[] = []

  for (const post of sorted) {
    if (confirmed.has(post.id)) continue
    const captionNorm = normalizeMatchText(post.caption)
    if (!captionNorm) continue

    const hits: ScoredHit[] = []
    for (const deal of active) {
      const hit = scoreDealAgainstCaption(deal, captionNorm)
      if (hit) hits.push(hit)
    }

    if (hits.length !== 1) continue

    const hit = hits[0]
    const suggestionId = `${post.id}::${hit.deal.id}`
    if (dismissed.has(suggestionId)) continue

    // Deal must still have room to film
    const incomplete = hit.deal.filmingChecklist.some((i) => !i.completed)
    if (!incomplete && (hit.deal.retainerTotalVideos ?? 0) > 0) continue

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

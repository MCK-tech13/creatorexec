/** One recent TikTok post caption — mock now; later from video.list. */
export interface CaptionPost {
  id: string
  caption: string
  /** ISO date (YYYY-MM-DD) when the video was posted. */
  postedAt: string
}

export type CaptionMatchConfidence = 'high' | 'medium'

/**
 * Unambiguous suggestion: one caption confidently matches one active deal.
 * Ambiguous captions (2+ deals) are never surfaced.
 */
export interface CaptionMatchSuggestion {
  id: string
  captionPostId: string
  caption: string
  postedAt: string
  dealId: string
  brandName: string
  product: string
  confidence: CaptionMatchConfidence
  matchedOn: 'brand' | 'product' | 'brand_words'
}

/**
 * KNOWN DEMO SIMPLIFICATION (not fixing now):
 * Confirm marks the next incomplete filmingChecklist item — a generic +1 —
 * not a specific deliverable row tied to which caption fulfilled which video.
 */
export const CAPTION_MATCH_CONFIRM_SIMPLIFICATION =
  'Confirm toggles the next incomplete filmingChecklist item (generic increment), not a specific deliverable matched to the caption.'

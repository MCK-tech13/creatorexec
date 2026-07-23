/**
 * Caption → retainer match helpers (mock captions for Preview demo).
 */
export type {
  CaptionMatchConfidence,
  CaptionMatchSuggestion,
  CaptionPost,
} from './types'
export { CAPTION_MATCH_CONFIRM_SIMPLIFICATION } from './types'
export { MOCK_CAPTION_POSTS, CAPTION_MATCH_DEMO_BRANDS, fetchRecentCaptions } from './mockCaptions'
export { normalizeMatchText, buildCaptionMatchSuggestions } from './matcher'
export {
  dismissSuggestion,
  confirmCaptionSuggestion,
  resetCaptionMatchSuggestionHistory,
  loadDismissedSuggestionIds,
  loadConfirmedCaptionIds,
} from './suggestionStore'
export { buildCaptionMatchDemoDealInserts, dealsMissingCaptionDemoBrands } from './demoDeals'

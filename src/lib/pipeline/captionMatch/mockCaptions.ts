import type { CaptionPost } from './types'

/**
 * Seeded stand-in for TikTok video.list recent captions.
 * Swap this module's `fetchRecentCaptions` for a real API call once
 * `video.list` scope is approved — keep the CaptionPost shape stable.
 */
export const MOCK_CAPTION_POSTS: CaptionPost[] = [
  {
    id: 'mock-cap-novaglow-clear',
    caption:
      'Day 3 with NovaGlow vitamin C — pores look smoother already #ad #NovaGlowPartner',
    postedAt: '2026-07-22',
  },
  {
    id: 'mock-cap-sipwell-clear',
    caption: 'Morning reset with my SipWell Co electrolyte mix 💧 link in bio',
    postedAt: '2026-07-21',
  },
  {
    id: 'mock-cap-ambiguous',
    // Intentionally hits both NovaGlow + SipWell if both deals are active.
    caption: 'GRWM featuring NovaGlow and SipWell Co on my vanity today',
    postedAt: '2026-07-20',
  },
  {
    id: 'mock-cap-no-match',
    caption: 'Rainy day vlog — thrift haul and coffee runs, no brand tags',
    postedAt: '2026-07-19',
  },
  {
    id: 'mock-cap-already-dismissed-seed',
    caption: 'Trying the NovaGlow overnight mask before bed #gifted',
    postedAt: '2026-07-18',
  },
  {
    id: 'mock-cap-unrelated-brand',
    caption: 'Obsessed with this random desk lamp from the clearance aisle',
    postedAt: '2026-07-17',
  },
]

/** Demo brand names that pair with MOCK_CAPTION_POSTS for Preview walkthroughs. */
export const CAPTION_MATCH_DEMO_BRANDS = {
  novaGlow: { brandName: 'NovaGlow', product: 'Vitamin C Serum' },
  sipWell: { brandName: 'SipWell Co', product: 'Electrolyte Mix' },
} as const

/**
 * Fetch recent captions. Mock-only for now — replace body with TikTok video.list
 * when the scope is approved; keep the return type unchanged.
 */
export async function fetchRecentCaptions(_options?: {
  accessToken?: string
}): Promise<CaptionPost[]> {
  return [...MOCK_CAPTION_POSTS]
}

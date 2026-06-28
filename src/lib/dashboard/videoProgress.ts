import { TIER_REVIEW_VIDEO_COUNT } from '../../types'

export function getVideoProgressColor(_filmed: number): string {
  return 'bg-emerald'
}

export function isReadyForTierReview(filmed: number): boolean {
  return filmed >= TIER_REVIEW_VIDEO_COUNT
}

export { TIER_REVIEW_VIDEO_COUNT }

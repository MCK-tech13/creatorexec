import type { SopTier } from '../../types'
import { sopTierToLegacyTier } from '../../lib/analysis/sopTierAssign'

/** Display labels for SOP ranks (UI). */
export function formatSopTierLabel(tier: SopTier): string {
  switch (tier) {
    case 'BandA':
      return 'Band A'
    case 'BandB':
      return 'Band B'
    case 'NewSample':
      return 'New Sample'
    default:
      return tier
  }
}

/** Map SOP tier → existing badge color tokens via legacy dashboard tiers. */
export function sopTierBadgeTone(tier: SopTier) {
  return sopTierToLegacyTier(tier)
}

export const SOP_TIER_TAB_ORDER: SopTier[] = [
  'Anchor',
  'Rotator',
  'Mid',
  'BandA',
  'BandB',
  'Urgent',
  'NewSample',
  'Retired',
]

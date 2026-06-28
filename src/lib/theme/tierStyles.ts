import type { ScheduleTierLabel, Tier } from '../../types'

type TierStyle = { bg: string; text: string; border: string }

/** Solid editorial tier badges with high contrast text. */
export const TIER_STYLES: Record<Tier, TierStyle> = {
  Anchor: {
    bg: 'bg-tier-anchor',
    text: 'text-cream',
    border: 'border-tier-anchor',
  },
  Rising: {
    bg: 'bg-tier-rising',
    text: 'text-cream',
    border: 'border-tier-rising',
  },
  Test: {
    bg: 'bg-tier-test',
    text: 'text-cream',
    border: 'border-tier-test',
  },
  Cut: {
    bg: 'bg-tier-cut',
    text: 'text-cream',
    border: 'border-tier-cut',
  },
}

export const SCHEDULE_TIER_STYLES: Record<ScheduleTierLabel, TierStyle> = {
  ...TIER_STYLES,
  Deadline: {
    bg: 'bg-tier-deadline',
    text: 'text-cream',
    border: 'border-tier-deadline',
  },
}

/** Soft tinted variants for tabs and secondary UI. */
export const TIER_TAB_STYLES: Record<Tier, TierStyle> = {
  Anchor: {
    bg: 'bg-tier-anchor/10',
    text: 'text-tier-anchor',
    border: 'border-tier-anchor/30',
  },
  Rising: {
    bg: 'bg-tier-rising/10',
    text: 'text-tier-rising',
    border: 'border-tier-rising/30',
  },
  Test: {
    bg: 'bg-tier-test/10',
    text: 'text-tier-test',
    border: 'border-tier-test/30',
  },
  Cut: {
    bg: 'bg-tier-cut/10',
    text: 'text-tier-cut',
    border: 'border-tier-cut/30',
  },
}

import type { ScheduleTierLabel, Tier } from '../../types'

type TierStyle = { bg: string; text: string; border: string; dot: string }

const BADGE_BASE = 'tier-badge'

export const TIER_STYLES: Record<Tier, TierStyle> = {
  Anchor: {
    bg: 'bg-tier-anchor',
    text: 'text-tier-anchor-text',
    border: 'border-0',
    dot: 'bg-tier-anchor-text',
  },
  Rising: {
    bg: 'bg-tier-rising',
    text: 'text-tier-rising-text',
    border: 'border-0',
    dot: 'bg-tier-rising-dot',
  },
  Test: {
    bg: 'bg-white',
    text: 'text-tier-test-text',
    border: 'border border-tier-test-border',
    dot: 'bg-tier-test-dot',
  },
  Cut: {
    bg: 'bg-white',
    text: 'text-tier-cut-text',
    border: 'border border-tier-cut-border',
    dot: 'bg-tier-cut-dot',
  },
}

export const SCHEDULE_TIER_STYLES: Record<ScheduleTierLabel, TierStyle> = {
  ...TIER_STYLES,
  Retainer: {
    bg: 'bg-tier-retainer',
    text: 'text-tier-rising-text',
    border: 'border-0',
    dot: 'bg-tier-rising-dot',
  },
  Deadline: {
    bg: 'bg-tier-deadline',
    text: 'text-tier-anchor-text',
    border: 'border-0',
    dot: 'bg-tier-anchor-text',
  },
}

export const TIER_BADGE_CLASS = BADGE_BASE

export const TIER_TAB_STYLES: Record<Tier, TierStyle> = TIER_STYLES

export function tierStyleFor(tier: Tier | ScheduleTierLabel): TierStyle {
  return SCHEDULE_TIER_STYLES[tier]
}

export function tierBadgeClass(tier: Tier | ScheduleTierLabel): string {
  const style = tierStyleFor(tier)
  return `${BADGE_BASE} ${style.bg} ${style.text} ${style.border}`
}

export function tierBadgeDotClass(tier: Tier | ScheduleTierLabel): string {
  return `tier-badge-dot ${tierStyleFor(tier).dot}`
}

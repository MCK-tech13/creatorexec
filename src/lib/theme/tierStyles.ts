import type { ScheduleTierLabel, Tier } from '../../types'

type TierStyle = { bg: string; text: string; border: string }

const BADGE_BASE =
  'badge-compact inline-flex px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider'

export const TIER_STYLES: Record<Tier, TierStyle> = {
  Anchor: {
    bg: 'bg-tier-anchor',
    text: 'text-white',
    border: 'border-0',
  },
  Rising: {
    bg: 'bg-tier-rising',
    text: 'text-white',
    border: 'border-0',
  },
  Test: {
    bg: 'bg-tier-test',
    text: 'text-tier-test-text',
    border: 'border-0',
  },
  Cut: {
    bg: 'bg-transparent',
    text: 'text-tier-cut-text',
    border: 'border border-border-warm',
  },
}

export const SCHEDULE_TIER_STYLES: Record<ScheduleTierLabel, TierStyle> = {
  ...TIER_STYLES,
  Deadline: {
    bg: 'bg-tier-deadline',
    text: 'text-white',
    border: 'border-0',
  },
}

export const TIER_BADGE_CLASS = BADGE_BASE

export const TIER_TAB_STYLES: Record<Tier, TierStyle> = TIER_STYLES

export function tierBadgeClass(tier: Tier | ScheduleTierLabel): string {
  const style =
    tier === 'Deadline' ? SCHEDULE_TIER_STYLES.Deadline : TIER_STYLES[tier as Tier]
  return `${BADGE_BASE} ${style.bg} ${style.text} ${style.border}`
}

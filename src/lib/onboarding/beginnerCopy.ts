import type { ScheduleTierLabel, Tier } from '../../types'

export const TIER_TOOLTIPS: Record<Tier, string> = {
  Anchor: 'Your proven top earners — film these every sprint',
  Rising: 'Gaining momentum — worth filming more',
  Test: 'New or unproven — give each at least 6 videos before judging',
  Cut: 'Low performers — consider removing from rotation',
}

export const SCHEDULE_TIER_EXPLANATIONS: Partial<Record<ScheduleTierLabel, string>> = {
  Anchor: 'Top earner — film daily',
  Rising: 'Building momentum',
  Test: 'Needs more data — film once this sprint',
}

export function getScheduleTierExplanation(tier: ScheduleTierLabel): string | null {
  return SCHEDULE_TIER_EXPLANATIONS[tier] ?? null
}

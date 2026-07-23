import { useId, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import type { ScheduleTierLabel, SopTier, Tier } from '../../types'
import {
  TIER_BADGE_CLASS,
  TIER_STYLES,
  tierBadgeDotClass,
  tierStyleFor,
} from '../../lib/theme/tierStyles'
import { TIER_TOOLTIPS } from '../../lib/onboarding/beginnerCopy'
import {
  formatSopTierLabel,
  sopTierBadgeTone,
} from '../../lib/analysis/sopTierLabels'

interface TierBadgeProps {
  tier: Tier | ScheduleTierLabel
  /** When set, badge shows SOP label with legacy color tone. */
  sopTier?: SopTier
  showTooltip?: boolean
}

function isProductTier(tier: Tier | ScheduleTierLabel): tier is Tier {
  return tier in TIER_STYLES
}

export function TierBadge({ tier, sopTier, showTooltip = false }: TierBadgeProps) {
  const toneTier = sopTier ? sopTierBadgeTone(sopTier) : tier
  const style = tierStyleFor(toneTier)
  const label = sopTier ? formatSopTierLabel(sopTier) : tier
  const tooltipId = useId()
  const [open, setOpen] = useState(false)

  const badge = (
    <span className={`${TIER_BADGE_CLASS} ${style.bg} ${style.text} ${style.border}`}>
      <span className={tierBadgeDotClass(toneTier)} aria-hidden />
      {label}
    </span>
  )

  if (!showTooltip || !isProductTier(tier) || sopTier) {
    return badge
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {badge}
      <span className="relative inline-flex">
        <button
          type="button"
          className="text-stone transition hover:text-emerald"
          aria-label={`What does ${tier} mean?`}
          aria-describedby={open ? tooltipId : undefined}
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onBlur={() => setOpen(false)}
        >
          <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        {open && (
          <span
            id={tooltipId}
            role="tooltip"
            className="absolute top-full left-1/2 z-20 mt-2 w-56 -translate-x-1/2 border border-border-warm bg-white px-3 py-2 font-body text-xs leading-relaxed text-ink"
          >
            {TIER_TOOLTIPS[tier]}
          </span>
        )}
      </span>
    </span>
  )
}

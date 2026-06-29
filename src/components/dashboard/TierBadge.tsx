import { useId, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import type { Tier } from '../../types'
import { TIER_BADGE_CLASS, TIER_STYLES } from '../../lib/theme/tierStyles'
import { TIER_TOOLTIPS } from '../../lib/onboarding/beginnerCopy'

interface TierBadgeProps {
  tier: Tier
  showTooltip?: boolean
}

export function TierBadge({ tier, showTooltip = false }: TierBadgeProps) {
  const style = TIER_STYLES[tier]
  const tooltipId = useId()
  const [open, setOpen] = useState(false)

  if (!showTooltip) {
    return (
      <span className={`${TIER_BADGE_CLASS} ${style.bg} ${style.text} ${style.border}`}>
        {tier}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`${TIER_BADGE_CLASS} ${style.bg} ${style.text} ${style.border}`}>
        {tier}
      </span>
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
            className="absolute top-full left-1/2 z-20 mt-2 w-56 -translate-x-1/2 border border-border-warm bg-cream-card px-3 py-2 font-sans text-xs leading-relaxed text-ink shadow-sm"
          >
            {TIER_TOOLTIPS[tier]}
          </span>
        )}
      </span>
    </span>
  )
}

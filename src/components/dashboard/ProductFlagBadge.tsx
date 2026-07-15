import { useId, useState } from 'react'
import { PauseCircle, TrendingDown } from 'lucide-react'
import { PRODUCT_FLAG_COMMISSION_NOTE } from '../../types/sprintReview'

type ProductFlagKind = 'stalled' | 'slowing'

interface ProductFlagBadgeProps {
  kind: ProductFlagKind
}

const FLAG_STYLES: Record<
  ProductFlagKind,
  { label: string; className: string; icon: typeof PauseCircle }
> = {
  stalled: {
    label: 'Stalled',
    className: 'border-stone/30 bg-stone/5 text-stone',
    icon: PauseCircle,
  },
  slowing: {
    label: 'Slowing down',
    className: 'border-amber-600/25 bg-amber-50 text-amber-900',
    icon: TrendingDown,
  },
}

export function ProductFlagBadge({ kind }: ProductFlagBadgeProps) {
  const style = FLAG_STYLES[kind]
  const Icon = style.icon
  const tooltipId = useId()
  const [open, setOpen] = useState(false)
  const showCommissionNote = kind === 'slowing'

  return (
    <span className="relative inline-flex">
      <span
        className={`inline-flex items-center gap-1 border px-2 py-0.5 font-body text-[10px] font-medium uppercase tracking-[0.08em] ${style.className}`}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Icon className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden />
        {style.label}
      </span>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute top-full left-0 z-20 mt-2 w-56 border border-border-warm bg-white px-3 py-2 font-body text-xs leading-relaxed text-ink"
        >
          {kind === 'stalled'
            ? 'No tier movement for two consecutive sprints. Consider whether this product still deserves filming slots.'
            : 'Commission has declined at least 15% for three consecutive sprints.'}
          {showCommissionNote && (
            <span className="mt-2 block text-stone">{PRODUCT_FLAG_COMMISSION_NOTE}</span>
          )}
        </span>
      )}
    </span>
  )
}

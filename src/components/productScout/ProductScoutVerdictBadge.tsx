import type { ProductScoutVerdict } from '../../types/productScout'

const VERDICT_STYLES: Record<
  ProductScoutVerdict,
  { bg: string; text: string; dot: string }
> = {
  strong: {
    bg: 'bg-emerald',
    text: 'text-white',
    dot: 'bg-stat-sage',
  },
  test: {
    bg: 'bg-terracotta-tint border border-terracotta/50',
    text: 'text-ink',
    dot: 'bg-terracotta',
  },
  pass: {
    bg: 'bg-white border border-border-warm',
    text: 'text-stone',
    dot: 'bg-grey-light',
  },
  insufficient: {
    bg: 'bg-white border border-dashed border-border-warm',
    text: 'text-stone',
    dot: 'bg-grey',
  },
}

export function ProductScoutVerdictBadge({
  verdict,
  label,
  compact = false,
}: {
  verdict: ProductScoutVerdict
  label: string
  compact?: boolean
}) {
  const styles = VERDICT_STYLES[verdict]

  return (
    <span
      className={`tier-badge ${styles.bg} ${styles.text} ${compact ? 'badge-compact' : ''}`}
    >
      <span className={`tier-badge-dot ${styles.dot}`} aria-hidden />
      {label}
    </span>
  )
}

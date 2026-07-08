import type { ProductScoutScoreResult, ProductScoutSignal } from '../../types/productScout'
import { formatPercent } from '../../lib/productScout/metricParser'
import { ContentPolicyDisclaimer } from '../ui/ContentPolicyDisclaimer'
import { ProductScoutVerdictBadge } from './ProductScoutVerdictBadge'

const SENTIMENT_STYLES = {
  positive: {
    border: 'border-emerald/30',
    bg: 'bg-stat-sage/60',
    points: 'text-emerald',
    marker: 'bg-emerald',
    detail: 'text-emerald',
  },
  neutral: {
    border: 'border-blush/50',
    bg: 'bg-blush-tint',
    points: 'text-ink',
    marker: 'bg-blush',
    detail: 'text-stone',
  },
  negative: {
    border: 'border-blush/60',
    bg: 'bg-blush-tint',
    points: 'text-ink',
    marker: 'bg-stone',
    detail: 'text-stone',
  },
  muted: {
    border: 'border-border-warm',
    bg: 'bg-white',
    points: 'text-grey',
    marker: 'bg-grey-light',
    detail: 'text-grey',
  },
} as const

function formatPoints(points: number): string {
  if (points > 0) return `+${points}`
  return String(points)
}

function SignalRow({ signal }: { signal: ProductScoutSignal }) {
  const styles = SENTIMENT_STYLES[signal.sentiment]

  return (
    <div className={`border px-4 py-4 ${styles.border} ${styles.bg}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${styles.marker}`} aria-hidden />
            <p className="font-body text-sm font-semibold text-ink">{signal.label}</p>
          </div>
          <p className={`mt-1 font-body text-sm ${styles.detail}`}>{signal.detail}</p>
        </div>
        <span className={`shrink-0 font-body text-sm font-semibold tabular-nums ${styles.points}`}>
          {formatPoints(signal.points)}
        </span>
      </div>
    </div>
  )
}

export function ProductScoutResults({ result }: { result: ProductScoutScoreResult }) {
  return (
    <div className="space-y-6">
      <div className="border border-border-warm bg-blush-tint px-6 py-6">
        <p className="label-caps mb-3">Verdict</p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <ProductScoutVerdictBadge verdict={result.verdict} label={result.verdictLabel} />
          <p className="font-body text-sm text-stone">
            Total score:{' '}
            <span className="font-semibold text-ink tabular-nums">{formatPoints(result.totalScore)}</span>
          </p>
        </div>
        {result.atcConversionRate !== null && (
          <p className="mt-4 font-body text-sm text-stone">
            ATC → order conversion:{' '}
            <span className="font-semibold text-ink">
              {formatPercent(result.atcConversionRate)}
            </span>
            <span className="text-grey"> (calculated from Orders ÷ ATC users)</span>
          </p>
        )}
      </div>

      <div>
        <p className="label-caps mb-3">Signal breakdown</p>
        <div className="space-y-2">
          {result.signals.map((signal) => (
            <SignalRow key={signal.id} signal={signal} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 font-body text-xs text-stone">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald" aria-hidden />
            Positive
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blush" aria-hidden />
            Neutral
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-stone" aria-hidden />
            Negative
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-grey-light" aria-hidden />
            No data
          </span>
        </div>
      </div>

      <div className="border border-emerald/20 bg-stat-sage/40 px-6 py-5">
        <p className="label-caps mb-2 text-emerald">Funnel recommendation</p>
        <p className="font-display text-base font-semibold text-ink sm:text-lg">{result.funnel.headline}</p>
        {result.funnel.detail && (
          <p className="mt-2 font-body text-sm leading-relaxed text-stone">{result.funnel.detail}</p>
        )}
        <ContentPolicyDisclaimer className="mt-4 border-t border-emerald/10 pt-4" />
      </div>
    </div>
  )
}

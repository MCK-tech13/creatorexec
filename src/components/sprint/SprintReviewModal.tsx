import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { SprintReview } from '../../types/sprintReview'
import { TierBadge } from '../dashboard/TierBadge'

interface SprintReviewModalProps {
  review: SprintReview
  onContinue: () => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDelta(amount: number): string {
  const prefix = amount > 0 ? '+' : amount < 0 ? '−' : ''
  return `${prefix}${formatCurrency(Math.abs(amount))}`
}

function Section({
  title,
  children,
  empty,
}: {
  title: string
  children: ReactNode
  empty?: string
}) {
  return (
    <section className="border border-border-warm bg-white">
      <h3 className="border-b border-border-warm px-5 py-3 font-body text-[11px] font-medium uppercase tracking-[0.14em] text-stone sm:px-6">
        {title}
      </h3>
      <div className="px-5 py-4 sm:px-6 sm:py-5">
        {empty ? (
          <p className="font-body text-sm text-stone">{empty}</p>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

export function SprintReviewModal({ review, onContinue }: SprintReviewModalProps) {
  const { commission, topPerformer } = review
  const commissionIncreased =
    commission.delta !== null ? commission.delta > 0 : false
  const commissionDecreased =
    commission.delta !== null ? commission.delta < 0 : false
  const commissionFlat = commission.delta === 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-8 sm:items-center sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sprint-review-title"
    >
      <div className="w-full max-w-2xl border border-border-warm bg-cream fade-in">
        <div className="border-b border-emerald bg-blush-tint px-5 py-6 sm:px-8 sm:py-8">
          <p className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-emerald">
            Sprint complete
          </p>
          <h2
            id="sprint-review-title"
            className="font-display mt-2 text-2xl font-bold text-ink sm:text-3xl"
          >
            What happened this sprint
          </h2>
          <p className="mt-2 font-body text-sm text-stone sm:text-base">
            A quick recap before you start your next sprint.
          </p>
        </div>

        <div className="space-y-4 px-4 py-6 sm:space-y-5 sm:px-6 sm:py-8">
          <Section
            title="Commission"
            empty={
              review.hasPreviousSprint
                ? undefined
                : 'First tracked sprint — upload another report next time to compare totals.'
            }
          >
            {review.hasPreviousSprint && commission.previousTotal !== null && (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="stat-label">This sprint</p>
                  <p className="font-display mt-1 text-3xl font-bold text-stat-forest">
                    {formatCurrency(commission.currentTotal)}
                  </p>
                  <p className="mt-1 font-body text-sm text-stone">
                    Previous: {formatCurrency(commission.previousTotal)}
                  </p>
                </div>
                {commission.delta !== null && (
                  <div
                    className={`inline-flex items-center gap-2 border px-4 py-2 font-body text-sm font-medium ${
                      commissionIncreased
                        ? 'border-emerald/30 bg-emerald/5 text-emerald'
                        : commissionDecreased
                          ? 'border-blush/60 bg-blush-tint text-ink'
                          : 'border-border-warm bg-white text-stone'
                    }`}
                  >
                    {commissionIncreased ? (
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                    ) : commissionDecreased ? (
                      <ArrowDownRight className="h-4 w-4" aria-hidden />
                    ) : (
                      <Minus className="h-4 w-4" aria-hidden />
                    )}
                    <span>
                      {formatDelta(commission.delta)}
                      {commission.percentChange !== null && !commissionFlat && (
                        <span className="ml-1 text-stone">
                          ({commission.percentChange > 0 ? '+' : ''}
                          {Math.round(commission.percentChange)}%)
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Section>

          {topPerformer && (
            <section className="border border-emerald/30 bg-stat-sage px-5 py-5 sm:px-6 sm:py-6">
              <p className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-emerald">
                Top performer
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="font-display text-xl font-bold text-ink sm:text-2xl">
                  {topPerformer.productName}
                </p>
                <TierBadge tier={topPerformer.tier} />
              </div>
              <p className="mt-2 font-body text-sm text-stone">
                {formatCurrency(topPerformer.commission)} commission this sprint
              </p>
            </section>
          )}

          <Section
            title="Tier movement"
            empty="No tier changes this sprint."
          >
            {review.tierMovements.length > 0 && (
              <ul className="divide-y divide-border-warm">
                {review.tierMovements.map((movement) => (
                  <li
                    key={`${movement.productName}-${movement.previousTier}-${movement.newTier}`}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="font-body text-sm font-medium text-ink sm:text-base">
                      {movement.productName}
                    </p>
                    <div className="flex items-center gap-2">
                      <TierBadge tier={movement.previousTier} />
                      <span className="font-body text-sm text-stone">→</span>
                      <TierBadge tier={movement.newTier} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Trials completed"
            empty="No products completed their 6-video trial this sprint."
          >
            {review.trialCompletions.length > 0 && (
              <ul className="divide-y divide-border-warm">
                {review.trialCompletions.map((trial) => (
                  <li
                    key={trial.productName}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="font-body text-sm font-medium text-ink sm:text-base">
                      {trial.productName}
                    </p>
                    <div className="flex items-center gap-2">
                      <TierBadge tier={trial.newTier} />
                      <span
                        className={`font-body text-sm ${
                          trial.outcome === 'Cut' ? 'text-stone' : 'text-emerald'
                        }`}
                      >
                        {trial.outcome}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <section className="border border-blush/40 bg-blush-tint px-5 py-4 sm:px-6 sm:py-5">
            <p className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-stone">
              Still in progress
            </p>
            <p className="font-display mt-2 text-2xl font-bold text-ink">
              {review.trialsInProgress}
            </p>
            <p className="mt-1 font-body text-sm text-stone">
              {review.trialsInProgress === 1
                ? 'product still mid-trial heading into next sprint'
                : 'products still mid-trial heading into next sprint'}
            </p>
          </section>
        </div>

        <div className="border-t border-border-warm px-4 py-4 sm:px-6 sm:py-5">
          <button type="button" onClick={onContinue} className="btn-primary w-full py-3.5">
            Continue to next sprint
          </button>
        </div>
      </div>
    </div>
  )
}

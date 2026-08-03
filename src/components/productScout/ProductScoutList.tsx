import { scoreProductScout } from '../../lib/productScout/scorer'
import { isScoutPromotedToSprint } from '../../lib/productScout/promoteScoutToSprint'
import type { ProductScoutEntry } from '../../types/productScout'
import { ProductScoutVerdictBadge } from './ProductScoutVerdictBadge'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ProductScoutList({
  entries,
  selectedId,
  onSelect,
  onAddToSprint,
  promotingId,
}: {
  entries: ProductScoutEntry[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAddToSprint: (id: string) => void
  promotingId: string | null
}) {
  if (entries.length === 0) {
    return (
      <div className="border border-border-warm bg-terracotta-tint px-6 py-8 text-center">
        <p className="font-body text-sm text-ink sm:text-base">No products scored yet.</p>
        <p className="mt-2 font-body text-sm text-stone">
          Score a potential product from TikTok&apos;s Product trends screen and build your product
          list over time.
        </p>
      </div>
    )
  }

  return (
    <div className="border border-border-warm divide-y divide-border-warm">
      {entries.map((entry) => {
        const result = scoreProductScout(entry.metrics)
        const isSelected = entry.id === selectedId
        const alreadyInSprint = isScoutPromotedToSprint(entry)
        const isPromoting = promotingId === entry.id

        return (
          <div
            key={entry.id}
            className={`flex w-full items-start justify-between gap-3 px-5 py-4 transition hover:bg-terracotta-tint/60 ${
              isSelected ? 'bg-terracotta-tint ring-1 ring-inset ring-emerald/30' : 'bg-white'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(entry.id)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="font-body text-sm font-semibold text-ink sm:text-base">
                {entry.productName}
              </p>
              <p className="mt-1 font-body text-xs text-stone">
                Scored {formatDate(entry.updatedAt)}
                {result && (
                  <>
                    {' '}
                    · Score{' '}
                    <span className="tabular-nums font-medium text-ink">
                      {result.totalScore > 0 ? `+${result.totalScore}` : result.totalScore}
                    </span>
                  </>
                )}
              </p>
              {alreadyInSprint && (
                <p className="mt-1 font-body text-xs font-medium text-emerald">Added to sprint</p>
              )}
            </button>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {result && (
                <ProductScoutVerdictBadge
                  verdict={result.verdict}
                  label={result.verdictLabel}
                  compact
                />
              )}
              {alreadyInSprint ? (
                <span className="font-body text-xs text-stone">In sprint</span>
              ) : (
                <button
                  type="button"
                  disabled={isPromoting}
                  onClick={(event) => {
                    event.stopPropagation()
                    onAddToSprint(entry.id)
                  }}
                  className="btn-outline px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {isPromoting ? 'Adding…' : 'Add to Sprint'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

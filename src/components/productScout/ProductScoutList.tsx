import { scoreProductScout } from '../../lib/productScout/scorer'
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
}: {
  entries: ProductScoutEntry[]
  selectedId: string | null
  onSelect: (id: string) => void
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

        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelect(entry.id)}
            className={`flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-terracotta-tint/60 ${
              isSelected ? 'bg-terracotta-tint ring-1 ring-inset ring-emerald/30' : 'bg-white'
            }`}
          >
            <div className="min-w-0">
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
            </div>
            {result && (
              <ProductScoutVerdictBadge
                verdict={result.verdict}
                label={result.verdictLabel}
                compact
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

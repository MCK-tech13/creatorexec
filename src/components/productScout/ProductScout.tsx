import { useMemo, useState } from 'react'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import type { ProductScoutEntry } from '../../types/productScout'
import { scoreProductScout } from '../../lib/productScout/scorer'
import { entryToFormDefaults } from '../../lib/productScout/formDefaults'
import { ProductScoutForm } from './ProductScoutForm'
import { ProductScoutList } from './ProductScoutList'
import { ProductScoutResults } from './ProductScoutResults'
import { ProductScoutVerdictBadge } from './ProductScoutVerdictBadge'

type ViewMode = 'list' | 'new' | 'detail' | 'edit'

interface ProductScoutProps {
  entries: ProductScoutEntry[]
  onAddEntry: (
    productName: string,
    metrics: ProductScoutEntry['metrics'],
  ) => ProductScoutEntry
  onUpdateEntry: (
    id: string,
    patch: Partial<Pick<ProductScoutEntry, 'productName' | 'metrics'>>,
  ) => void
  onRemoveEntry: (id: string) => void
}

export function ProductScout({
  entries,
  onAddEntry,
  onUpdateEntry,
  onRemoveEntry,
}: ProductScoutProps) {
  const [view, setView] = useState<ViewMode>(entries.length === 0 ? 'new' : 'list')
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null)

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedId) ?? null,
    [entries, selectedId],
  )

  const selectedResult = selectedEntry ? scoreProductScout(selectedEntry.metrics) : null

  const openDetail = (id: string) => {
    setSelectedId(id)
    setView('detail')
  }

  const handleDelete = (id: string) => {
    onRemoveEntry(id)
    setSelectedId(null)
    setView(entries.length <= 1 ? 'new' : 'list')
  }

  return (
    <div className="fade-in">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl md:text-4xl">
            Product Scout
          </h1>
          <p className="mt-2 max-w-2xl font-body text-sm text-stone sm:text-base">
            Pre-purchase scoring for new products — separate from your sprint tiers. Enter TikTok
            Product trends data to decide whether something is worth adding to rotation.
          </p>
        </div>
        {view === 'list' && (
          <button
            type="button"
            onClick={() => setView('new')}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 px-6 py-3 text-sm sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Score New Product
          </button>
        )}
      </div>

      {view === 'list' && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,340px)_1fr]">
          <div>
            <p className="label-caps mb-3">Your shortlist</p>
            <ProductScoutList
              entries={entries}
              selectedId={selectedId}
              onSelect={openDetail}
            />
          </div>
          <div className="border border-border-warm bg-white p-6">
            {selectedEntry && selectedResult ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="label-caps mb-2">Selected product</p>
                    <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
                      {selectedEntry.productName}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setView('edit')}
                      className="btn-outline inline-flex items-center gap-2 px-4 py-2 text-sm"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedEntry.id)}
                      className="btn-outline inline-flex items-center gap-2 px-4 py-2 text-sm text-stone hover:border-blush hover:text-ink"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
                <ProductScoutResults result={selectedResult} />
              </div>
            ) : (
              <div className="flex h-full min-h-[240px] items-center justify-center text-center">
                <p className="font-body text-sm text-stone">
                  Select a product from your shortlist to review its score and funnel plan.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'new' && (
        <div className="max-w-3xl">
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => setView('list')}
              className="link-elegant mb-6 inline-flex items-center gap-2 font-body text-sm text-stone"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to shortlist
            </button>
          )}
          <div className="border border-border-warm bg-white p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
              Score a new product
            </h2>
            <p className="mt-2 font-body text-sm text-stone">
              Each scored product is saved to your shortlist — come back anytime to compare
              opportunities.
            </p>
            <div className="mt-8">
              <ProductScoutForm
                submitLabel="Save to shortlist"
                onSubmit={(productName, metrics) => {
                  const entry = onAddEntry(productName, metrics)
                  setSelectedId(entry.id)
                  setView('detail')
                }}
                onCancel={() => setView(entries.length > 0 ? 'list' : 'list')}
              />
            </div>
          </div>
        </div>
      )}

      {view === 'detail' && selectedEntry && selectedResult && (
        <div className="max-w-3xl">
          <button
            type="button"
            onClick={() => setView('list')}
            className="link-elegant mb-6 inline-flex items-center gap-2 font-body text-sm text-stone"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to shortlist
          </button>
          <div className="border border-border-warm bg-white p-6 sm:p-8">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="label-caps mb-2">Scored product</p>
                <h2 className="font-display text-2xl font-bold text-ink">{selectedEntry.productName}</h2>
                <div className="mt-3">
                  <ProductScoutVerdictBadge
                    verdict={selectedResult.verdict}
                    label={selectedResult.verdictLabel}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setView('edit')}
                  className="btn-outline inline-flex items-center gap-2 px-4 py-2 text-sm"
                >
                  <Pencil className="h-4 w-4" />
                  Edit metrics
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(selectedEntry.id)}
                  className="btn-outline inline-flex items-center gap-2 px-4 py-2 text-sm text-stone hover:border-blush hover:text-ink"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </div>
            <ProductScoutResults result={selectedResult} />
          </div>
        </div>
      )}

      {view === 'edit' && selectedEntry && (
        <div className="max-w-3xl">
          <button
            type="button"
            onClick={() => setView('detail')}
            className="link-elegant mb-6 inline-flex items-center gap-2 font-body text-sm text-stone"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to score
          </button>
          <div className="border border-border-warm bg-white p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">Edit product metrics</h2>
            <div className="mt-8">
              <ProductScoutForm
                {...entryToFormDefaults(selectedEntry)}
                submitLabel="Update score"
                onSubmit={(productName, metrics) => {
                  onUpdateEntry(selectedEntry.id, { productName, metrics })
                  setView('detail')
                }}
                onCancel={() => setView('detail')}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

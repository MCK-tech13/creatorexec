import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, List, Pencil, Plus, Trash2 } from 'lucide-react'
import type { ProductScoutEntry, ProductScoutMetrics } from '../../types/productScout'
import { scoreProductScout } from '../../lib/productScout/scorer'
import { entryToFormDefaults } from '../../lib/productScout/formDefaults'
import {
  clearProductScoutDraft,
  loadProductScoutDraft,
  type ProductScoutDraft,
} from '../../lib/version/productScoutDraft'
import { ProductScoutForm } from './ProductScoutForm'
import { ProductScoutList } from './ProductScoutList'
import { ProductScoutResults } from './ProductScoutResults'
import { ProductScoutVerdictBadge } from './ProductScoutVerdictBadge'

type ViewMode = 'list' | 'new' | 'detail' | 'edit'

interface ProductScoutProps {
  entries: ProductScoutEntry[]
  persistError?: string | null
  onClearPersistError?: () => void
  onAddEntry: (
    productName: string,
    metrics: ProductScoutEntry['metrics'],
  ) => ProductScoutEntry | Promise<ProductScoutEntry>
  onUpdateEntry: (
    id: string,
    patch: Partial<Pick<ProductScoutEntry, 'productName' | 'metrics'>>,
  ) => void | Promise<void>
  onRemoveEntry: (id: string) => void | Promise<void>
}

/** StrictMode-safe one-shot draft consume (module scope survives remount). */
let consumedProductScoutDraft: ProductScoutDraft | null | undefined

function takeProductScoutDraft(): ProductScoutDraft | null {
  if (consumedProductScoutDraft !== undefined) {
    return consumedProductScoutDraft
  }
  const draft = loadProductScoutDraft()
  if (draft) clearProductScoutDraft()
  consumedProductScoutDraft = draft
  return draft
}

export function ProductScout({
  entries,
  persistError = null,
  onClearPersistError,
  onAddEntry,
  onUpdateEntry,
  onRemoveEntry,
}: ProductScoutProps) {
  const restoredDraft = useMemo(() => takeProductScoutDraft(), [])
  const [view, setView] = useState<ViewMode>(() => {
    if (restoredDraft?.mode === 'edit' && restoredDraft.editId) return 'edit'
    if (restoredDraft) return 'new'
    return entries.length === 0 ? 'new' : 'list'
  })
  const [selectedId, setSelectedId] = useState<string | null>(
    () => restoredDraft?.editId ?? entries[0]?.id ?? null,
  )
  const [draftSeed, setDraftSeed] = useState<{
    productName: string
    metrics: ProductScoutMetrics
  } | null>(
    restoredDraft
      ? { productName: restoredDraft.productName, metrics: restoredDraft.metrics }
      : null,
  )

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedId) ?? null,
    [entries, selectedId],
  )

  const selectedResult = selectedEntry ? scoreProductScout(selectedEntry.metrics) : null

  useEffect(() => {
    if (view === 'edit' && restoredDraft?.mode === 'edit' && !selectedEntry) {
      setView('new')
      setSelectedId(null)
    }
  }, [view, restoredDraft, selectedEntry])

  const openList = () => {
    setDraftSeed(null)
    setView('list')
    if (entries.length > 0 && !selectedId) {
      setSelectedId(entries[0].id)
    }
  }

  const openDetail = (id: string) => {
    setDraftSeed(null)
    setSelectedId(id)
    setView('detail')
  }

  const handleDelete = async (id: string) => {
    onClearPersistError?.()
    try {
      await onRemoveEntry(id)
      setSelectedId(null)
      setView(entries.length <= 1 ? 'new' : 'list')
    } catch (err) {
      console.error(err)
    }
  }

  const newFormDefaults = draftSeed
    ? { initialName: draftSeed.productName, initialMetrics: draftSeed.metrics }
    : {}

  const editFormDefaults = selectedEntry
    ? draftSeed && restoredDraft?.mode === 'edit' && restoredDraft.editId === selectedEntry.id
      ? { initialName: draftSeed.productName, initialMetrics: draftSeed.metrics }
      : entryToFormDefaults(selectedEntry)
    : null


  return (
    <div className="fade-in">
      {persistError && (
        <div
          className="mb-6 border border-terracotta/50 bg-terracotta-tint px-4 py-3"
          role="alert"
        >
          <p className="font-body text-sm font-semibold text-ink">Could not save to Supabase</p>
          <p className="mt-1 font-body text-sm text-ink break-words">{persistError}</p>
          <p className="mt-2 font-body text-xs text-stone">
            List/detail scores are computed live from metrics — they can look correct even when this
            write fails. Copy the message above (also in the console as{' '}
            <code className="text-ink">[ProductScout] persist failed</code> /{' '}
            <code className="text-ink">window.__CE_LAST_PERSIST_ERROR__</code>).
          </p>
          {onClearPersistError && (
            <button
              type="button"
              className="mt-3 font-body text-sm text-stone underline"
              onClick={onClearPersistError}
            >
              Dismiss
            </button>
          )}
        </div>
      )}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl md:text-4xl">
            Product Scout
          </h1>
          <p className="mt-2 max-w-2xl font-body text-sm text-stone sm:text-base">
            Pre-purchase scoring for new products — separate from your sprint tiers. Score
            opportunities and build a running list of products you&apos;re considering for
            rotation.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {view !== 'list' && (
            <button
              type="button"
              onClick={openList}
              className="btn-outline inline-flex w-full items-center justify-center gap-2 px-6 py-3 text-sm sm:w-auto"
            >
              <List className="h-4 w-4" />
              My Product List
            </button>
          )}
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
      </div>

      {view === 'list' && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,340px)_1fr]">
          <div>
            <p className="label-caps mb-3">My Product List</p>
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
                      className="btn-outline inline-flex items-center gap-2 px-4 py-2 text-sm text-stone hover:border-terracotta hover:text-ink"
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
                  {entries.length === 0
                    ? 'Score a product to start your list — verdict, score, and funnel plan are saved with each entry.'
                    : 'Select a product from My Product List to review its score and funnel plan.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'new' && (
        <div className="w-full">
          <div className="border border-border-warm bg-white p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
              Score a new product
            </h2>
            <p className="mt-2 font-body text-sm text-stone">
              Enter TikTok Product trends data below. When you&apos;re ready, add the product to
              your list with its verdict, score, and funnel recommendation attached.
            </p>
            <div className="mt-8">
              <ProductScoutForm
                {...newFormDefaults}
                formMode="new"
                submitLabel="Add to Product List"
                onSubmit={async (productName, metrics) => {
                  setDraftSeed(null)
                  onClearPersistError?.()
                  try {
                    const entry = await onAddEntry(productName, metrics)
                    setSelectedId(entry.id)
                    setView('list')
                  } catch (err) {
                    // persistError banner is set by the hook; keep the form open.
                    console.error(err)
                  }
                }}
                onCancel={openList}
              />
            </div>
          </div>
        </div>
      )}

      {view === 'detail' && selectedEntry && selectedResult && (
        <div className="w-full">
          <button
            type="button"
            onClick={openList}
            className="link-elegant mb-6 inline-flex items-center gap-2 font-body text-sm text-stone"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Product List
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
                  className="btn-outline inline-flex items-center gap-2 px-4 py-2 text-sm text-stone hover:border-terracotta hover:text-ink"
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
        <div className="w-full">
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
              {editFormDefaults && selectedEntry && (
                <ProductScoutForm
                  {...editFormDefaults}
                  formMode="edit"
                  editId={selectedEntry.id}
                  submitLabel="Save to Product List"
                  onSubmit={async (productName, metrics) => {
                    setDraftSeed(null)
                    onClearPersistError?.()
                    try {
                      await onUpdateEntry(selectedEntry.id, { productName, metrics })
                      setView('list')
                    } catch (err) {
                      console.error(err)
                    }
                  }}
                  onCancel={() => {
                    setDraftSeed(null)
                    setView('detail')
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

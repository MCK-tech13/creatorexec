import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { BrandDeal, BrandDealInsert, DealStage } from '../../types/pipeline'
import { DEAL_STAGES } from '../../types/pipeline'
import { DealCard } from './DealCard'
import { DealDetailView } from './DealDetailView'
import { NewDealModal } from './NewDealModal'

interface RetainerDealsProps {
  deals: BrandDeal[]
  dailyPostingVolume: number
  onAddDeal: (deal: BrandDealInsert) => void
  onUpdateDeal: (id: string, patch: Partial<BrandDeal>) => void
  onMoveDeal: (dealId: string, stage: DealStage) => void
  onRemoveDeal: (id: string) => void
  onToggleChecklist: (dealId: string, itemId: string) => void
  openNewDealRequest?: boolean
  onNewDealOpenHandled?: () => void
}

export function RetainerDeals({
  deals,
  dailyPostingVolume,
  onAddDeal,
  onUpdateDeal,
  onMoveDeal,
  onRemoveDeal,
  onToggleChecklist,
  openNewDealRequest = false,
  onNewDealOpenHandled,
}: RetainerDealsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DealStage | null>(null)

  useEffect(() => {
    if (openNewDealRequest) {
      setShowNewDeal(true)
      onNewDealOpenHandled?.()
    }
  }, [openNewDealRequest, onNewDealOpenHandled])

  const selectedDeal = deals.find((d) => d.id === selectedId) ?? null

  const dealsByStage = useMemo(() => {
    const map = new Map<DealStage, BrandDeal[]>()
    for (const stage of DEAL_STAGES) {
      map.set(stage.id, [])
    }
    for (const deal of deals) {
      map.get(deal.stage)?.push(deal)
    }
    return map
  }, [deals])

  const handleDrop = (stage: DealStage) => {
    if (draggingId) {
      onMoveDeal(draggingId, stage)
    }
    setDraggingId(null)
    setDropTarget(null)
  }

  return (
    <div className="fade-in">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">
            Retainer Deals
          </h1>
          <p className="mt-2 font-body text-base text-stone">
            Track partnerships from first pitch through payment — retainers sync to your sprint
            schedule automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewDeal(true)}
          className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm"
        >
          <Plus className="h-4 w-4" />
          New Deal
        </button>
      </div>

      {deals.length === 0 && (
        <div className="mb-8 border border-border-warm bg-blush-tint px-6 py-5 text-center">
          <p className="font-body text-base text-ink">No retainer deals yet.</p>
          <button
            type="button"
            onClick={() => setShowNewDeal(true)}
            className="link-elegant mt-2 font-body text-sm text-emerald"
          >
            Add your first deal →
          </button>
        </div>
      )}

      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-max gap-4">
          {DEAL_STAGES.map((stage) => {
            const columnDeals = dealsByStage.get(stage.id) ?? []
            const isDropTarget = dropTarget === stage.id

            return (
              <div
                key={stage.id}
                className={`w-64 shrink-0 border border-border-warm bg-white ${
                  isDropTarget ? 'ring-1 ring-emerald' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDropTarget(stage.id)
                }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDrop(stage.id)
                }}
              >
                <div className="border-b border-border-warm px-4 py-3">
                  <h2 className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-stone">
                    {stage.label}
                  </h2>
                  <span className="mt-1 block font-body text-xs text-grey">
                    {columnDeals.length}
                  </span>
                </div>
                <div className="space-y-3 p-3">
                  {columnDeals.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      onClick={() => setSelectedId(deal.id)}
                      onDragStart={() => setDraggingId(deal.id)}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setDropTarget(null)
                      }}
                    />
                  ))}
                  {columnDeals.length === 0 && (
                    <p className="py-6 text-center font-body text-xs text-grey-light">
                      Drop deals here
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedDeal && (
        <DealDetailView
          deal={selectedDeal}
          dailyPostingVolume={dailyPostingVolume}
          onUpdate={(patch) => onUpdateDeal(selectedDeal.id, patch)}
          onDelete={() => {
            onRemoveDeal(selectedDeal.id)
            setSelectedId(null)
          }}
          onClose={() => setSelectedId(null)}
          onToggleChecklist={(itemId) => onToggleChecklist(selectedDeal.id, itemId)}
        />
      )}

      {showNewDeal && (
        <NewDealModal onClose={() => setShowNewDeal(false)} onSubmit={onAddDeal} />
      )}
    </div>
  )
}

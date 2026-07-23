import { useCallback, useEffect, useState } from 'react'
import type { BrandDeal, BrandDealInsert, DealStage } from '../types/pipeline'
import {
  createBrandDeal,
  deleteBrandDeal,
  loadBrandDeals,
  moveDealToStage,
  saveBrandDeals,
  updateBrandDealInList,
} from '../lib/pipeline/dealStorage'
import { syncFilmingChecklist } from '../lib/pipeline/retainerUtils'

export function useBrandDeals() {
  const [deals, setDeals] = useState<BrandDeal[]>(() => loadBrandDeals())

  useEffect(() => {
    saveBrandDeals(deals)
  }, [deals])

  const addDeal = useCallback((partial: BrandDealInsert) => {
    let deal = createBrandDeal(partial)
    const targetCount = deal.isRetainer
      ? (deal.retainerTotalVideos ?? 0)
      : (deal.videosRequired ?? 0)
    if (targetCount > 0) {
      deal = {
        ...deal,
        filmingChecklist: syncFilmingChecklist(deal, targetCount),
      }
    }
    setDeals((prev) => [...prev, deal])
    return deal
  }, [])

  const updateDeal = useCallback((id: string, patch: Partial<BrandDeal>) => {
    setDeals((prev) => {
      let next = updateBrandDealInList(prev, id, patch)
      const deal = next.find((d) => d.id === id)
      if (!deal) return next

      const targetCount = deal.isRetainer
        ? (deal.retainerTotalVideos ?? 0)
        : (deal.videosRequired ?? 0)

      if (targetCount > 0) {
        const synced = syncFilmingChecklist(deal, targetCount)
        if (synced !== deal.filmingChecklist) {
          next = updateBrandDealInList(next, id, { filmingChecklist: synced })
        }
      }
      return next
    })
  }, [])

  const moveDeal = useCallback((dealId: string, stage: DealStage) => {
    setDeals((prev) => moveDealToStage(prev, dealId, stage))
  }, [])

  const removeDeal = useCallback((id: string) => {
    setDeals((prev) => deleteBrandDeal(prev, id))
  }, [])

  const toggleChecklistItem = useCallback((dealId: string, itemId: string) => {
    setDeals((prev) =>
      prev.map((deal) => {
        if (deal.id !== dealId) return deal
        return {
          ...deal,
          filmingChecklist: deal.filmingChecklist.map((item) =>
            item.id === itemId ? { ...item, completed: !item.completed } : item,
          ),
          updatedAt: new Date().toISOString(),
        }
      }),
    )
  }, [])

  /**
   * Caption-match Confirm path.
   * KNOWN SIMPLIFICATION: marks the next incomplete checklist item (generic +1),
   * not a specific deliverable tied to which caption fulfilled which video.
   */
  const completeNextIncompleteChecklistItem = useCallback((dealId: string): boolean => {
    let didComplete = false
    setDeals((prev) =>
      prev.map((deal) => {
        if (deal.id !== dealId) return deal
        const nextIncomplete = deal.filmingChecklist.find((item) => !item.completed)
        if (!nextIncomplete) return deal
        didComplete = true
        return {
          ...deal,
          filmingChecklist: deal.filmingChecklist.map((item) =>
            item.id === nextIncomplete.id ? { ...item, completed: true } : item,
          ),
          updatedAt: new Date().toISOString(),
        }
      }),
    )
    return didComplete
  }, [])

  return {
    deals,
    addDeal,
    updateDeal,
    moveDeal,
    removeDeal,
    toggleChecklistItem,
    completeNextIncompleteChecklistItem,
  }
}

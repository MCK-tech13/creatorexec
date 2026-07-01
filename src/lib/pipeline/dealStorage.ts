import type { BrandDeal, BrandDealInsert, DealStage } from '../../types/pipeline'

const STORAGE_KEY = 'creatorexec-brand-deals'

function defaultDeal(partial: BrandDealInsert): BrandDeal {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    brandName: partial.brandName.trim(),
    product: partial.product?.trim() ?? '',
    stage: partial.stage,
    dealType: partial.dealType,
    compensation: partial.compensation,
    commissionPercent: partial.commissionPercent,
    videosRequired: partial.videosRequired,
    deadlineDate: partial.deadlineDate,
    contractSigned: partial.contractSigned ?? false,
    notes: partial.notes,
    videoLink: partial.videoLink,
    adCode: partial.adCode,
    isRetainer: partial.isRetainer ?? false,
    retainerTotalVideos: partial.retainerTotalVideos,
    retainerDeadlineDate: partial.retainerDeadlineDate,
    filmingChecklist: partial.filmingChecklist ?? [],
    createdAt: now,
    updatedAt: now,
  }
}

export function loadBrandDeals(): BrandDeal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as BrandDeal[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((deal) => ({
      ...deal,
      isRetainer: deal.isRetainer ?? false,
      contractSigned: deal.contractSigned ?? false,
      filmingChecklist: deal.filmingChecklist ?? [],
      product: deal.product ?? '',
    }))
  } catch {
    return []
  }
}

export function saveBrandDeals(deals: BrandDeal[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deals))
}

export function createBrandDeal(partial: BrandDealInsert): BrandDeal {
  return defaultDeal(partial)
}

export function updateBrandDealInList(
  deals: BrandDeal[],
  id: string,
  patch: Partial<BrandDeal>,
): BrandDeal[] {
  return deals.map((deal) =>
    deal.id === id
      ? { ...deal, ...patch, id: deal.id, updatedAt: new Date().toISOString() }
      : deal,
  )
}

export function moveDealToStage(
  deals: BrandDeal[],
  dealId: string,
  stage: DealStage,
): BrandDeal[] {
  return updateBrandDealInList(deals, dealId, { stage })
}

export function deleteBrandDeal(deals: BrandDeal[], id: string): BrandDeal[] {
  return deals.filter((d) => d.id !== id)
}

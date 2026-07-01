export type DealStage =
  | 'negotiating'
  | 'contract_sent'
  | 'sample_otw'
  | 'filming'
  | 'posted'
  | 'awaiting_payment'
  | 'paid_closed'

export type DealType = 'video' | 'live' | 'bundle'

export interface FilmingChecklistItem {
  id: string
  completed: boolean
}

/** Brand deal record — shape mirrors a future Supabase `brand_deals` row. */
export interface BrandDeal {
  id: string
  brandName: string
  product: string
  stage: DealStage
  dealType?: DealType
  compensation?: number
  commissionPercent?: number
  videosRequired?: number
  deadlineDate?: string
  contractSigned: boolean
  notes?: string
  videoLink?: string
  adCode?: string
  isRetainer: boolean
  retainerTotalVideos?: number
  retainerDeadlineDate?: string
  filmingChecklist: FilmingChecklistItem[]
  createdAt: string
  updatedAt: string
}

export type BrandDealInsert = Pick<BrandDeal, 'brandName' | 'stage'> &
  Partial<Omit<BrandDeal, 'id' | 'brandName' | 'stage' | 'createdAt' | 'updatedAt'>>

export const DEAL_STAGES: { id: DealStage; label: string }[] = [
  { id: 'negotiating', label: 'Negotiating' },
  { id: 'contract_sent', label: 'Contract Sent/Signed' },
  { id: 'sample_otw', label: 'Sample OTW' },
  { id: 'filming', label: 'Filming' },
  { id: 'posted', label: 'Posted' },
  { id: 'awaiting_payment', label: 'Awaiting Payment' },
  { id: 'paid_closed', label: 'Paid/Closed' },
]

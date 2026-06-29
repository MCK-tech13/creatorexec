export type Tier = 'Anchor' | 'Rising' | 'Test' | 'Cut'

export type ScheduleTierLabel = Tier | 'Deadline'

export type ManualTier = 'Anchor' | 'Rising' | 'Test'

export type SprintDays = 3 | 7 | 14

export const TIER_REVIEW_VIDEO_COUNT = 6

/** One row from an order-level TikTok Shop export */
export interface RawOrderRow {
  productName: string
  productId: string
  gmv: number
  itemsSold: number
  estStandardCommission: number
  estShopAdsCommission: number
}

export interface MergedProduct {
  id: string
  productName: string
  productId: string
  gmv: number
  commission: number
  itemsSold: number
  orderCount: number
  videosFilmed: number
  score: number
  tier: Tier
  rankInTier: number
  inRotation: boolean
  isManual: boolean
}

export interface DeadlineProduct {
  id: string
  productName: string
  brand: string
  deadlineDate: string
  videosRequired: number
  videosFilmed: number
}

export interface SprintConfig {
  videosPerDay: number
  sprintDays: SprintDays
}

export interface ScheduledVideo {
  slotId: string
  productKey: string
  productId: string
  productName: string
  tier: ScheduleTierLabel
  suggestedAngle: string
  commission: number
  videosFilmed: number
  deadlineDate?: string
  brand?: string
}

export interface DaySchedule {
  day: number
  videos: ScheduledVideo[]
}

export type AppStage = 'upload' | 'sample' | 'dashboard' | 'config' | 'schedule'

export type SampleProductType = 'sample' | 'favorite'

export interface SampleProduct {
  id: string
  productName: string
  brand: string
  dateReceived: string
  type: SampleProductType
}

export interface ColumnMapping {
  productName: number
  productId: number
  gmv: number
  itemsSold: number
  estStandardCommission: number
  estShopAdsCommission: number
}

export interface ParseResult {
  products: Omit<MergedProduct, 'score' | 'tier' | 'rankInTier'>[]
  headers: string[]
}

export interface ParseError {
  message: string
  foundHeaders: string[]
}

export interface ManualProductFormData {
  productName: string
  commission: number
  tier: ManualTier
  videosFilmed: number
}

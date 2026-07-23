export type Tier = 'Anchor' | 'Rising' | 'Test' | 'Cut'

/** SOP-mode live ranks / winner / pipeline labels (Creator SOP). */
export type SopTier =
  | 'Anchor'
  | 'Rotator'
  | 'Mid'
  | 'BandA'
  | 'BandB'
  | 'NewSample'
  | 'Urgent'
  | 'Retired'

export type ScheduleTierLabel = Tier | 'Deadline' | 'Retainer'

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
  /**
   * Present when scheduleMode is `sop`. Legacy `tier` is a dashboard-compatible
   * mapping until SOP-specific UI lands.
   */
  sopTier?: SopTier
  rankInTier: number
  inRotation: boolean
  isManual: boolean
  /**
   * Soft scheduling priority for Test trial ordering.
   * Never forces Rising/Anchor — sales data still owns tier.
   */
  isFavorite?: boolean
  /**
   * Optional TikTok sample post-by date.
   * Only the first trial video carries this deadline; videos 2–6 stay normal Test slots.
   */
  firstVideoDeadline?: string | null
}

export interface DeadlineProduct {
  id: string
  productName: string
  brand: string
  deadlineDate: string
  videosRequired: number
  videosFilmed: number
}

/** Pipeline retainer injected into sprint schedule (maps to future Supabase join). */
export interface RetainerScheduleEntry {
  dealId: string
  brandName: string
  productName: string
  slotsPerDay: number
  deadlineDate: string
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
  /** Plain-language explanation of why this slot was scheduled. */
  placementReason?: string
}

export interface DaySchedule {
  day: number
  videos: ScheduledVideo[]
}

export type AppStage = 'upload' | 'sample' | 'momentum' | 'dashboard' | 'config' | 'schedule'

export type MainSection = 'home' | 'sprint' | 'retainers' | 'income' | 'product-scout'

export type ScheduleMode = 'full' | 'momentum' | 'sop'

/** @deprecated Legacy value persisted in older sprint rows; coerce to `full`. */
export type LegacyScheduleMode = ScheduleMode | 'sample'

export type SampleProductType = 'sample' | 'favorite'

export interface SampleProduct {
  id: string
  productName: string
  brand: string
  dateReceived: string
  type: SampleProductType
  /** Optional — applies only to the first posted trial video. */
  firstVideoDeadline?: string
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
  /** Optional — applies only to the first posted trial video when still at 0 filmed. */
  firstVideoDeadline?: string
}

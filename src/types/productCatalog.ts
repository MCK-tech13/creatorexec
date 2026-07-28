/** Durable product catalog entry — survives current_sprint_state clears. */
export type CatalogProductSource = 'csv' | 'manual' | 'sample' | 'backfill'

export interface CatalogProduct {
  id: string
  displayName: string
  brand: string | null
  /** Primary TikTok Shop product ID when known; null for unlinked manual/sample rows. */
  externalProductId: string | null
  /**
   * Additional TikTok product IDs manually linked to this catalog row.
   * Future CSV rows with any of these IDs update this product instead of creating a new row.
   */
  linkedExternalIds: string[]
  source: CatalogProductSource
  isFavorite: boolean
  gmv: number
  commission: number
  itemsSold: number
  orderCount: number
  inRotation: boolean
  isManual: boolean
  dateReceived: string | null
  /** Optional TikTok sample post-by date — first trial video only. */
  firstVideoDeadline: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Snapshot used to undo a manual product merge. */
export interface CatalogMergeRecord {
  id: string
  createdAt: string
  undoneAt: string | null
  survivorId: string
  survivorDisplayName: string
  absorbedIds: string[]
  /** Full catalog rows before merge (survivor + absorbed). */
  beforeProducts: CatalogProduct[]
  /** Trial progress entries for involved keys before merge. */
  beforeTrial: Record<string, { videosFilmed: number; source?: 'sales-history' | 'manual' }>
  /** Trial progress written onto the survivor after merge. */
  afterTrialVideosFilmed: number
}

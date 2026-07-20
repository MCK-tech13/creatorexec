/** Durable product catalog entry — survives current_sprint_state clears. */
export type CatalogProductSource = 'csv' | 'manual' | 'sample' | 'backfill'

export interface CatalogProduct {
  id: string
  displayName: string
  brand: string | null
  /** TikTok Shop product ID when known; null for unlinked manual/sample rows. */
  externalProductId: string | null
  source: CatalogProductSource
  isFavorite: boolean
  gmv: number
  commission: number
  itemsSold: number
  orderCount: number
  inRotation: boolean
  isManual: boolean
  dateReceived: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

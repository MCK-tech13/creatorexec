import type { MergedProduct, ScheduleMode, SprintConfig, Tier } from './index'

export interface SprintProductSnapshot {
  key: string
  id: string
  productId: string
  productName: string
  commission: number
  tier: Tier
  videosFilmed: number
}

export interface SprintSnapshot {
  savedAt: string
  fileName: string | null
  config: SprintConfig
  scheduleMode: ScheduleMode
  totalCommission: number
  products: SprintProductSnapshot[]
}

export interface TierMovement {
  productName: string
  previousTier: Tier
  newTier: Tier
}

export interface TrialCompletion {
  productName: string
  outcome: string
  newTier: Tier
}

export interface CommissionComparison {
  currentTotal: number
  previousTotal: number | null
  delta: number | null
  percentChange: number | null
}

export interface SprintReview {
  hasPreviousSprint: boolean
  tierMovements: TierMovement[]
  trialCompletions: TrialCompletion[]
  commission: CommissionComparison
  topPerformer: SprintProductSnapshot | null
  trialsInProgress: number
}

export function snapshotFromProducts(
  products: MergedProduct[],
  config: SprintConfig,
  scheduleMode: ScheduleMode,
  fileName: string | null,
  productKey: (product: { id: string; productId: string }) => string,
): SprintSnapshot {
  const snapshots: SprintProductSnapshot[] = products.map((product) => ({
    key: productKey(product),
    id: product.id,
    productId: product.productId,
    productName: product.productName,
    commission: product.commission,
    tier: product.tier,
    videosFilmed: product.videosFilmed,
  }))

  return {
    savedAt: new Date().toISOString(),
    fileName,
    config,
    scheduleMode,
    totalCommission: products.reduce((sum, product) => sum + product.commission, 0),
    products: snapshots,
  }
}

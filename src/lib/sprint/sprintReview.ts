import { TIER_REVIEW_VIDEO_COUNT } from '../../types'
import type { Tier } from '../../types'
import type {
  CommissionComparison,
  SprintProductSnapshot,
  SprintReview,
  SprintSnapshot,
  TrialCompletion,
  TierMovement,
} from '../../types/sprintReview'

function findProduct(
  products: SprintProductSnapshot[],
  key: string,
): SprintProductSnapshot | undefined {
  return products.find((product) => product.key === key)
}

function trialOutcome(tier: Tier): string {
  if (tier === 'Cut') return 'Cut'
  if (tier === 'Anchor' || tier === 'Rising') return `Promoted to ${tier}`
  return 'Staying in Test'
}

function buildCommissionComparison(
  end: SprintSnapshot,
  previous: SprintSnapshot | null,
): CommissionComparison {
  const currentTotal = end.totalCommission
  if (!previous) {
    return {
      currentTotal,
      previousTotal: null,
      delta: null,
      percentChange: null,
    }
  }

  const previousTotal = previous.totalCommission
  const delta = currentTotal - previousTotal
  const percentChange =
    previousTotal > 0 ? (delta / previousTotal) * 100 : currentTotal > 0 ? 100 : 0

  return {
    currentTotal,
    previousTotal,
    delta,
    percentChange,
  }
}

export function buildSprintReview(
  sprintStart: SprintSnapshot | null,
  sprintEnd: SprintSnapshot,
  previousCompleted: SprintSnapshot | null,
): SprintReview {
  const tierMovements: TierMovement[] = []
  const trialCompletions: TrialCompletion[] = []

  if (sprintStart) {
    const startByKey = new Map(sprintStart.products.map((product) => [product.key, product]))

    for (const endProduct of sprintEnd.products) {
      const startProduct = startByKey.get(endProduct.key)
      if (!startProduct) continue

      if (startProduct.tier !== endProduct.tier) {
        tierMovements.push({
          productName: endProduct.productName,
          previousTier: startProduct.tier,
          newTier: endProduct.tier,
        })
      }

      if (
        startProduct.videosFilmed < TIER_REVIEW_VIDEO_COUNT &&
        endProduct.videosFilmed >= TIER_REVIEW_VIDEO_COUNT
      ) {
        trialCompletions.push({
          productName: endProduct.productName,
          outcome: trialOutcome(endProduct.tier),
          newTier: endProduct.tier,
        })
      }
    }

    for (const startProduct of sprintStart.products) {
      if (findProduct(sprintEnd.products, startProduct.key)) continue
      tierMovements.push({
        productName: startProduct.productName,
        previousTier: startProduct.tier,
        newTier: 'Cut',
      })
    }
  }

  tierMovements.sort((a, b) => a.productName.localeCompare(b.productName))
  trialCompletions.sort((a, b) => a.productName.localeCompare(b.productName))

  const topPerformer =
    sprintEnd.products.length > 0
      ? [...sprintEnd.products].sort((a, b) => b.commission - a.commission)[0]
      : null

  const trialsInProgress = sprintEnd.products.filter(
    (product) => product.tier === 'Test' && product.videosFilmed < TIER_REVIEW_VIDEO_COUNT,
  ).length

  return {
    hasPreviousSprint: previousCompleted !== null,
    tierMovements,
    trialCompletions,
    commission: buildCommissionComparison(sprintEnd, previousCompleted),
    topPerformer,
    trialsInProgress,
  }
}

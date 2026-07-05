/**
 * Run: npx tsx scripts/verify-sprint-review.ts
 */
import { TIER_REVIEW_VIDEO_COUNT } from '../src/types'
import type { MergedProduct, SprintConfig } from '../src/types'
import { buildSprintReview } from '../src/lib/sprint/sprintReview'
import { snapshotFromProducts } from '../src/types/sprintReview'

function mockProduct(
  id: string,
  name: string,
  tier: MergedProduct['tier'],
  commission: number,
  videosFilmed = 0,
): MergedProduct {
  return {
    id,
    productName: name,
    productId: `pid-${id}`,
    gmv: commission * 10,
    commission,
    itemsSold: tier === 'Test' ? 1 : 8,
    orderCount: 1,
    videosFilmed,
    score: commission,
    tier,
    rankInTier: 1,
    inRotation: true,
    isManual: false,
  }
}

function productKey(product: { id: string; productId: string }): string {
  return product.productId
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function runSprintReviewTest(): void {
  const config: SprintConfig = { videosPerDay: 5, sprintDays: 7 }

  const sprintStartProducts = [
    mockProduct('a1', 'Winner Serum', 'Rising', 120, 2),
    mockProduct('t1', 'Trial Mascara', 'Test', 30, 4),
    mockProduct('t2', 'Flop Balm', 'Test', 10, 5),
  ]

  const sprintEndProducts = [
    mockProduct('a1', 'Winner Serum', 'Anchor', 180, 4),
    mockProduct('t1', 'Trial Mascara', 'Rising', 55, TIER_REVIEW_VIDEO_COUNT),
    mockProduct('t2', 'Flop Balm', 'Cut', 8, TIER_REVIEW_VIDEO_COUNT),
  ]

  const previousProducts = [
    mockProduct('a1', 'Winner Serum', 'Rising', 90, 0),
    mockProduct('t1', 'Trial Mascara', 'Test', 20, 0),
  ]

  const sprintStart = snapshotFromProducts(
    sprintStartProducts,
    config,
    'full',
    'week-1.csv',
    productKey,
  )
  const sprintEnd = snapshotFromProducts(
    sprintEndProducts,
    config,
    'full',
    'week-2.csv',
    productKey,
  )
  const previous = snapshotFromProducts(
    previousProducts,
    config,
    'full',
    'week-0.csv',
    productKey,
  )

  const review = buildSprintReview(sprintStart, sprintEnd, previous)

  assert(review.tierMovements.length === 3, 'Should detect three tier movements')
  assert(
    review.tierMovements.some(
      (movement) =>
        movement.productName === 'Winner Serum' &&
        movement.previousTier === 'Rising' &&
        movement.newTier === 'Anchor',
    ),
    'Should show Rising → Anchor movement',
  )
  assert(review.trialCompletions.length === 2, 'Should detect two completed trials')
  assert(
    review.trialCompletions.some(
      (trial) => trial.productName === 'Trial Mascara' && trial.outcome === 'Promoted to Rising',
    ),
    'Promoted trial should be labeled correctly',
  )
  assert(
    review.trialCompletions.some(
      (trial) => trial.productName === 'Flop Balm' && trial.outcome === 'Cut',
    ),
    'Cut trial should be labeled correctly',
  )
  assert(review.commission.currentTotal === 243, 'Current commission total should match sprint end')
  assert(review.commission.previousTotal === 110, 'Previous commission total should match prior sprint')
  assert(review.commission.delta === 133, 'Commission delta should be computed')
  assert(review.topPerformer?.productName === 'Winner Serum', 'Top performer should be highest commission')
  assert(review.trialsInProgress === 0, 'No mid-trial products should remain')

  const firstSprintReview = buildSprintReview(sprintStart, sprintEnd, null)
  assert(!firstSprintReview.hasPreviousSprint, 'First sprint should not compare to a prior sprint')

  console.log('Sprint review checks passed.')
}

try {
  runSprintReviewTest()
  console.log('\nAll sprint review verification checks passed.')
} catch (error) {
  console.error('\nVERIFICATION FAILED:', error)
  process.exit(1)
}

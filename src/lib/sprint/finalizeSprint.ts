import type { MergedProduct, ScheduleMode, SprintConfig } from '../../types'
import type { SprintReview } from '../../types/sprintReview'
import { snapshotFromProducts } from '../../types/sprintReview'
import { buildSprintReview } from './sprintReview'
import { computeProductFlagsForReview } from './productFlags'
import {
  clearSprintStartSnapshot,
  loadPreviousSprintSnapshot,
  loadSprintStartSnapshot,
  savePreviousSprintSnapshot,
} from './sprintSnapshotStorage'
import { trialStorageKey } from '../schedule/trialProgressStorage'
import {
  getActiveUserId,
  getUserDataSnapshot,
  isDataStoreReady,
  prependSprintHistoryRecord,
} from '../supabase/dataStore'
import { getSupabaseClient } from '../supabase/client'
import { insertSprintHistoryRecord } from '../supabase/sprintHistory'

export function captureSprintEndReview(
  products: MergedProduct[],
  config: SprintConfig,
  scheduleMode: ScheduleMode,
  fileName: string | null,
): SprintReview | null {
  if (products.length === 0) return null

  const sprintStart = loadSprintStartSnapshot()
  const previousCompleted = loadPreviousSprintSnapshot()
  const endSnapshot = snapshotFromProducts(
    products,
    config,
    scheduleMode,
    fileName,
    trialStorageKey,
  )

  const review = buildSprintReview(sprintStart, endSnapshot, previousCompleted)
  const completedSprintEnds = getUserDataSnapshot().sprintHistory.map(
    (record) => record.endSnapshot,
  )
  const flags = computeProductFlagsForReview(completedSprintEnds, endSnapshot)
  review.stalledProducts = flags.stalledProducts
  review.slowingAnchors = flags.slowingAnchorProducts

  savePreviousSprintSnapshot(endSnapshot)
  clearSprintStartSnapshot()

  if (isDataStoreReady()) {
    const userId = getActiveUserId()
    const client = getSupabaseClient()
    void insertSprintHistoryRecord(client, userId, sprintStart, endSnapshot, review)
      .then(() => {
        prependSprintHistoryRecord({
          id: `local-${endSnapshot.savedAt}`,
          endedAt: endSnapshot.savedAt,
          endSnapshot,
        })
      })
      .catch((error) => {
        console.error('Failed to save sprint history', error)
      })
  }

  return review
}

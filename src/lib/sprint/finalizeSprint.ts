import type { MergedProduct, ScheduleMode, SprintConfig } from '../../types'
import type { SprintReview } from '../../types/sprintReview'
import { snapshotFromProducts } from '../../types/sprintReview'
import { buildSprintReview } from './sprintReview'
import {
  clearSprintStartSnapshot,
  loadPreviousSprintSnapshot,
  loadSprintStartSnapshot,
  savePreviousSprintSnapshot,
} from './sprintSnapshotStorage'
import { trialStorageKey } from '../schedule/trialProgressStorage'
import { getActiveUserId, isDataStoreReady } from '../supabase/dataStore'
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
  savePreviousSprintSnapshot(endSnapshot)
  clearSprintStartSnapshot()

  if (isDataStoreReady()) {
    const userId = getActiveUserId()
    void insertSprintHistoryRecord(getSupabaseClient(), userId, sprintStart, endSnapshot, review).catch(
      (error) => {
        console.error('Failed to save sprint history', error)
      },
    )
  }

  return review
}

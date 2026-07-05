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

  return review
}

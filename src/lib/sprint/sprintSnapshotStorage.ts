import type { SprintSnapshot } from '../../types/sprintReview'
import {
  getUserDataSnapshot,
  updateSprintPreviousSnapshot,
  updateSprintStartSnapshot,
} from '../supabase/dataStore'
import { scheduleOnboardingPersist } from '../supabase/sync'

export function loadSprintStartSnapshot(): SprintSnapshot | null {
  return getUserDataSnapshot().sprintStartSnapshot
}

export function saveSprintStartSnapshot(snapshot: SprintSnapshot): void {
  updateSprintStartSnapshot(snapshot)
  scheduleOnboardingPersist()
}

export function loadPreviousSprintSnapshot(): SprintSnapshot | null {
  return getUserDataSnapshot().sprintPreviousSnapshot
}

export function savePreviousSprintSnapshot(snapshot: SprintSnapshot): void {
  updateSprintPreviousSnapshot(snapshot)
  scheduleOnboardingPersist()
}

export function clearSprintStartSnapshot(): void {
  updateSprintStartSnapshot(null)
  scheduleOnboardingPersist()
}

export function clearSprintSnapshots(): void {
  updateSprintStartSnapshot(null)
  updateSprintPreviousSnapshot(null)
  scheduleOnboardingPersist()
}

import type { CurrentSprintState } from '../../types/currentSprint'
import {
  getUserDataSnapshot,
  updateCurrentSprintState,
} from '../supabase/dataStore'
import {
  scheduleCurrentSprintClear,
  scheduleCurrentSprintPersist,
} from '../supabase/sync'

export function loadCurrentSprintState(): CurrentSprintState | null {
  return getUserDataSnapshot().currentSprintState
}

export function saveCurrentSprintState(state: CurrentSprintState): void {
  updateCurrentSprintState(state)
  scheduleCurrentSprintPersist()
}

export function clearCurrentSprintState(): void {
  updateCurrentSprintState(null)
  scheduleCurrentSprintClear()
}

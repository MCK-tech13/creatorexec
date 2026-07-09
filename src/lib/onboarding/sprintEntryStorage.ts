import { getUserDataSnapshot, updateSprintEntrySeen } from '../supabase/dataStore'
import { scheduleOnboardingPersist } from '../supabase/sync'

/** Whether the user has already been routed to their Q1 entry screen. */
export function hasSeenSprintEntry(): boolean {
  return getUserDataSnapshot().sprintEntrySeen
}

export function markSprintEntrySeen(): void {
  updateSprintEntrySeen(true)
  scheduleOnboardingPersist()
}

export function clearSprintEntrySeen(): void {
  updateSprintEntrySeen(false)
  scheduleOnboardingPersist()
}

import { getUserDataSnapshot, updateUserEngagement } from '../supabase/dataStore'
import { scheduleUserEngagementPersist } from '../supabase/sync'
import type { UserEngagementState } from '../../types/userEngagement'

export function loadUserEngagement(): UserEngagementState {
  return getUserDataSnapshot().userEngagement
}

export function saveUserEngagement(state: UserEngagementState): void {
  updateUserEngagement(state)
  scheduleUserEngagementPersist()
}

export function markCsvUploadNow(isoTimestamp: string = new Date().toISOString()): void {
  const current = loadUserEngagement()
  saveUserEngagement({
    ...current,
    lastCsvUploadAt: isoTimestamp,
    // Fresh upload ends the overdue state; allow banner again next time it becomes overdue.
    uploadReminderDismissedAt: null,
  })
}

export function dismissUploadReminderBanner(
  isoTimestamp: string = new Date().toISOString(),
): void {
  const current = loadUserEngagement()
  saveUserEngagement({
    ...current,
    uploadReminderDismissedAt: isoTimestamp,
  })
}

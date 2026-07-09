import type { IncomeTrackerStore } from '../../types/incomeTracker'
import { getUserDataSnapshot, updateIncomeTracker } from '../supabase/dataStore'
import { scheduleIncomeTrackerPersist } from '../supabase/sync'

export function loadIncomeTracker(): IncomeTrackerStore {
  return getUserDataSnapshot().incomeTracker
}

export function saveIncomeTracker(store: IncomeTrackerStore): void {
  updateIncomeTracker(store)
  scheduleIncomeTrackerPersist()
}

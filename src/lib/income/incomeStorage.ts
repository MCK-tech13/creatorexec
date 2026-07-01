import type { IncomeTrackerStore } from '../../types/incomeTracker'

const STORAGE_KEY = 'creatorexec-income-tracker'

export function loadIncomeTracker(): IncomeTrackerStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as IncomeTrackerStore
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {}
    }
    return parsed
  } catch {
    return {}
  }
}

export function saveIncomeTracker(store: IncomeTrackerStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

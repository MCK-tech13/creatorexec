const STORAGE_KEY = 'creatorexec-sprint-entry-seen'

/** Whether the user has already been routed to their Q1 entry screen. */
export function hasSeenSprintEntry(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function markSprintEntrySeen(): void {
  localStorage.setItem(STORAGE_KEY, 'true')
}

export function clearSprintEntrySeen(): void {
  localStorage.removeItem(STORAGE_KEY)
}

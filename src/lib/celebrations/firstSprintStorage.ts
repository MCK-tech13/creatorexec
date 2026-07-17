const STORAGE_PREFIX = 'creatorexec-first-sprint-celebration-shown'

function storageKey(userId: string | null | undefined): string {
  return userId ? `${STORAGE_PREFIX}:${userId}` : STORAGE_PREFIX
}

export function hasSeenFirstSprintCelebration(userId?: string | null): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === 'true'
  } catch {
    return false
  }
}

export function markFirstSprintCelebrationSeen(userId?: string | null): void {
  try {
    localStorage.setItem(storageKey(userId), 'true')
  } catch {
    // ignore quota / private mode
  }
}

export function resetFirstSprintCelebrationSeen(userId?: string | null): void {
  try {
    localStorage.removeItem(storageKey(userId))
  } catch {
    // ignore
  }
}

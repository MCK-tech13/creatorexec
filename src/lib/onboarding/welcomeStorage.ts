const WELCOME_STORAGE_KEY = 'creatorexec-welcome-seen'

export function isWelcomeSeen(): boolean {
  try {
    return localStorage.getItem(WELCOME_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function markWelcomeSeen(): void {
  localStorage.setItem(WELCOME_STORAGE_KEY, 'true')
}

export function clearWelcomeSeen(): void {
  localStorage.removeItem(WELCOME_STORAGE_KEY)
}

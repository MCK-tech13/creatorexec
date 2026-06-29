import type { MonthlyCommissionLevel, OnboardingProfile, UserMode } from '../../types/onboarding'

const STORAGE_KEY = 'creatorexec-onboarding'

export function loadOnboardingProfile(): OnboardingProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OnboardingProfile & {
      answers?: OnboardingProfile['answers'] & { experience?: MonthlyCommissionLevel }
    }
    if (parsed?.completed !== true || !parsed.mode || !parsed.videosPerDay) {
      return null
    }
    if (parsed.answers?.experience && !parsed.answers.monthlyCommission) {
      parsed.answers.monthlyCommission = parsed.answers.experience
    }
    if (!parsed.answers?.monthlyCommission) {
      return null
    }
    return parsed as OnboardingProfile
  } catch {
    return null
  }
}

export function isOnboardingComplete(): boolean {
  return loadOnboardingProfile() !== null
}

export function saveOnboardingProfile(profile: OnboardingProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

export function updateUserMode(mode: UserMode): void {
  const existing = loadOnboardingProfile()
  if (!existing) return
  saveOnboardingProfile({ ...existing, mode })
}

export function clearOnboardingProfile(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function getStoredVideosPerDay(): number | null {
  return loadOnboardingProfile()?.videosPerDay ?? null
}

export function getStoredUserMode(): UserMode | null {
  return loadOnboardingProfile()?.mode ?? null
}

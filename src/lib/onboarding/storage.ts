import type { MonthlyCommissionLevel, OnboardingProfile, UserMode } from '../../types/onboarding'
import { getUserDataSnapshot, updateOnboardingProfile } from '../supabase/dataStore'
import { scheduleOnboardingPersist } from '../supabase/sync'

export function loadOnboardingProfile(): OnboardingProfile | null {
  return getUserDataSnapshot().onboardingProfile
}

export function isOnboardingComplete(): boolean {
  return loadOnboardingProfile() !== null
}

export function saveOnboardingProfile(profile: OnboardingProfile): void {
  updateOnboardingProfile(profile)
  scheduleOnboardingPersist()
}

export function updateUserMode(mode: UserMode): void {
  const existing = loadOnboardingProfile()
  if (!existing) return
  saveOnboardingProfile({ ...existing, mode })
}

export function clearOnboardingProfile(): void {
  updateOnboardingProfile(null)
  scheduleOnboardingPersist()
}

export function getStoredVideosPerDay(): number | null {
  return loadOnboardingProfile()?.videosPerDay ?? null
}

export function getStoredUserMode(): UserMode | null {
  return loadOnboardingProfile()?.mode ?? null
}

export function normalizeLegacyOnboardingProfile(
  parsed: OnboardingProfile & {
    answers?: OnboardingProfile['answers'] & { experience?: MonthlyCommissionLevel }
  },
): OnboardingProfile | null {
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
}

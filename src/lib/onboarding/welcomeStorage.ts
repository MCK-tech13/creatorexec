import { getUserDataSnapshot, updateWelcomeSeen } from '../supabase/dataStore'
import { scheduleOnboardingPersist } from '../supabase/sync'

export function isWelcomeSeen(): boolean {
  return getUserDataSnapshot().welcomeSeen
}

export function markWelcomeSeen(): void {
  updateWelcomeSeen(true)
  scheduleOnboardingPersist()
}

export function clearWelcomeSeen(): void {
  updateWelcomeSeen(false)
  scheduleOnboardingPersist()
}

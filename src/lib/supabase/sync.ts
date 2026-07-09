import { getSupabaseClient } from './client'
import { getActiveUserId, getUserDataSnapshot } from './dataStore'
import {
  persistBrandDeals,
  persistIncomeTracker,
  persistOnboardingState,
  persistProductScoutEntries,
  persistTrialProgress,
} from './persist'

let persistChain: Promise<void> = Promise.resolve()

function enqueuePersist(task: () => Promise<void>): void {
  persistChain = persistChain.then(task).catch((error) => {
    console.error('Failed to persist user data to Supabase', error)
  })
}

function withClient(task: (userId: string, client: ReturnType<typeof getSupabaseClient>) => Promise<void>): void {
  enqueuePersist(async () => {
    const userId = getActiveUserId()
    const client = getSupabaseClient()
    await task(userId, client)
  })
}

export function scheduleTrialProgressPersist(): void {
  withClient(async (userId, client) => {
    await persistTrialProgress(client, userId, getUserDataSnapshot().trialProgress)
  })
}

export function scheduleBrandDealsPersist(): void {
  withClient(async (userId, client) => {
    await persistBrandDeals(client, userId, getUserDataSnapshot().brandDeals)
  })
}

export function scheduleIncomeTrackerPersist(): void {
  withClient(async (userId, client) => {
    await persistIncomeTracker(client, userId, getUserDataSnapshot().incomeTracker)
  })
}

export function scheduleProductScoutPersist(): void {
  withClient(async (userId, client) => {
    await persistProductScoutEntries(client, userId, getUserDataSnapshot().productScoutEntries)
  })
}

export function scheduleOnboardingPersist(): void {
  withClient(async (userId, client) => {
    const snapshot = getUserDataSnapshot()
    await persistOnboardingState(client, userId, {
      onboardingProfile: snapshot.onboardingProfile,
      sprintEntrySeen: snapshot.sprintEntrySeen,
      welcomeSeen: snapshot.welcomeSeen,
      sprintStartSnapshot: snapshot.sprintStartSnapshot,
      sprintPreviousSnapshot: snapshot.sprintPreviousSnapshot,
    })
  })
}

export async function flushUserDataPersist(): Promise<void> {
  await persistChain
}

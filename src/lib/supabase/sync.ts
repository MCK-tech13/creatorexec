import { getSupabaseClient } from './client'
import { getActiveUserId, getUserDataSnapshot, updateCurrentSprintState } from './dataStore'
import {
  clearCurrentSprintStateRow,
  clearProductCatalogRows,
  persistBrandDeals,
  persistCurrentSprintState,
  persistIncomeTracker,
  persistOnboardingState,
  persistProductCatalog,
  persistProductScoutEntries,
  persistTrialProgress,
  persistUserEngagement,
} from './persist'
import { mergeAndConsumeLegacyFilmingProgress } from '../sprint/filmingProgressMigration'
import { hasPersistedSprintContent } from '../../types/currentSprint'

let persistChain: Promise<void> = Promise.resolve()
let currentSprintPersistTimer: ReturnType<typeof setTimeout> | null = null

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

export function scheduleProductCatalogPersist(): void {
  // Capture at schedule time so a later clearDataStore() cannot turn this into
  // an empty wipe when the queued task finally runs.
  const products = getUserDataSnapshot().productCatalog
  withClient(async (userId, client) => {
    await persistProductCatalog(client, userId, products)
  })
}

/** Onboarding reset only — deletes all durable catalog rows for the user. */
export function scheduleProductCatalogClear(): void {
  withClient(async (userId, client) => {
    await clearProductCatalogRows(client, userId)
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

export function scheduleUserEngagementPersist(): void {
  withClient(async (userId, client) => {
    await persistUserEngagement(client, userId, getUserDataSnapshot().userEngagement)
  })
}

function enqueueCurrentSprintPersistNow(): void {
  withClient(async (userId, client) => {
    const state = getUserDataSnapshot().currentSprintState
    if (!state || !hasPersistedSprintContent(state)) return

    const filmingProgress = mergeAndConsumeLegacyFilmingProgress(userId, state.filmingProgress)
    const nextState =
      filmingProgress === state.filmingProgress
        ? state
        : { ...state, filmingProgress }

    // Keep in-memory store aligned with what we write (merged legacy counts).
    if (nextState !== state) {
      updateCurrentSprintState(nextState)
    }

    await persistCurrentSprintState(client, userId, nextState)
  })
}

/** Debounced upsert of the live sprint workspace. */
export function scheduleCurrentSprintPersist(debounceMs = 400): void {
  if (currentSprintPersistTimer) {
    clearTimeout(currentSprintPersistTimer)
  }
  currentSprintPersistTimer = setTimeout(() => {
    currentSprintPersistTimer = null
    enqueueCurrentSprintPersistNow()
  }, debounceMs)
}

/** Explicit reset / new-sprint only — deletes the cloud row. */
export function scheduleCurrentSprintClear(): void {
  if (currentSprintPersistTimer) {
    clearTimeout(currentSprintPersistTimer)
    currentSprintPersistTimer = null
  }
  withClient(async (userId, client) => {
    await clearCurrentSprintStateRow(client, userId)
  })
}

export async function flushUserDataPersist(): Promise<void> {
  if (currentSprintPersistTimer) {
    clearTimeout(currentSprintPersistTimer)
    currentSprintPersistTimer = null
    enqueueCurrentSprintPersistNow()
  }
  await persistChain
}

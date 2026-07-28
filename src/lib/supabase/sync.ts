import { getSupabaseClient } from './client'
import { getActiveUserId, getUserDataSnapshot, updateCurrentSprintState } from './dataStore'
import {
  clearCurrentSprintStateRow,
  clearProductCatalogRows,
  persistBrandDeals,
  persistCatalogMergeHistory,
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

/**
 * Serializes Product Scout upserts so mount-backfill and submit cannot race.
 *
 * Reproduced on Production (PR #36): mount persistNow() and submit persistNow()
 * both called persistProductScoutEntries concurrently. The slower mount request
 * finished last with a stale snapshot (POST 200, empty Prefer body) and
 * overwrote the successful submit — UI looked correct until hydrate/reload,
 * then reverted to Pass / old metrics with __CE_LAST_PERSIST_ERROR__ unset.
 *
 * Mutex rule: acquire → read the *current* snapshot → upsert → release.
 * A submit that updates the snapshot while mount holds the lock waits, then
 * writes the latest list so the last queued persist wins.
 */
let productScoutPersistLock: Promise<void> = Promise.resolve()

async function withProductScoutPersistLock<T>(task: () => Promise<T>): Promise<T> {
  const previous = productScoutPersistLock
  let release!: () => void
  productScoutPersistLock = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  try {
    return await task()
  } finally {
    release()
  }
}

export function scheduleProductScoutPersist(): void {
  // Share the same lock as persistProductScoutEntriesNow (do not use the
  // generic enqueuePersist chain — that raced with awaited submit upserts).
  void persistProductScoutEntriesNow().catch((error) => {
    console.error('Failed to persist user data to Supabase', error)
  })
}

/**
 * Awaited Product Scout upsert — surfaces the real Supabase error to the caller.
 * Use on submit / mount backfill so silent background-chain failures cannot hide
 * a failed write. Serialized via withProductScoutPersistLock.
 */
export async function persistProductScoutEntriesNow(): Promise<void> {
  await withProductScoutPersistLock(async () => {
    const userId = getActiveUserId()
    const client = getSupabaseClient()
    // Read snapshot only while holding the lock so a concurrent submit's
    // syncProductScoutEntriesLocal() is visible to the next waiter.
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

export function scheduleCatalogMergeHistoryPersist(): void {
  const history = getUserDataSnapshot().catalogMergeHistory
  withClient(async (userId, client) => {
    await persistCatalogMergeHistory(client, userId, history)
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

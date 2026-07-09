import type { SupabaseClient } from '@supabase/supabase-js'
import type { IncomeTrackerStore } from '../../types/incomeTracker'
import type { OnboardingProfile } from '../../types/onboarding'
import type { BrandDeal } from '../../types/pipeline'
import type { ProductScoutEntry } from '../../types/productScout'
import { normalizeDealVideoDeliverables } from '../pipeline/videoDeliverableUtils'
import type { TrialProgressStore } from '../schedule/trialProgressStorage'
import type { UserDataSnapshot } from './dataStore'
import { LOCAL_STORAGE_KEYS, migrationFlagKey } from './localStorageKeys'
import { parseSprintSnapshot } from './mappers'
import {
  persistBrandDeals,
  persistIncomeTracker,
  persistOnboardingState,
  persistProductScoutEntries,
  persistTrialProgress,
} from './persist'
import type { Database } from './database.types'

type Client = SupabaseClient<Database>

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function readLocalTrialProgress(): TrialProgressStore {
  const parsed = readJson<TrialProgressStore>(LOCAL_STORAGE_KEYS.trialProgress)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  return Object.fromEntries(
    Object.entries(parsed).map(([key, entry]) => [
      key,
      {
        videosFilmed: Math.max(0, Number(entry?.videosFilmed) || 0),
        source: entry?.source,
      },
    ]),
  )
}

function readLocalBrandDeals(): BrandDeal[] {
  const parsed = readJson<BrandDeal[]>(LOCAL_STORAGE_KEYS.brandDeals)
  if (!Array.isArray(parsed)) return []
  return parsed.map((deal) =>
    normalizeDealVideoDeliverables({
      ...deal,
      isRetainer: deal.isRetainer ?? false,
      contractSigned: deal.contractSigned ?? false,
      filmingChecklist: deal.filmingChecklist ?? [],
      product: deal.product ?? '',
      videoDeliverables: deal.videoDeliverables ?? [],
    }),
  )
}

function readLocalIncomeTracker(): IncomeTrackerStore {
  const parsed = readJson<IncomeTrackerStore>(LOCAL_STORAGE_KEYS.incomeTracker)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  return parsed
}

function readLocalProductScout(): ProductScoutEntry[] {
  const parsed = readJson<ProductScoutEntry[]>(LOCAL_STORAGE_KEYS.productScout)
  return Array.isArray(parsed) ? parsed : []
}

function readLocalOnboardingProfile(): OnboardingProfile | null {
  const parsed = readJson<
    OnboardingProfile & {
      answers?: OnboardingProfile['answers'] & { experience?: OnboardingProfile['answers']['monthlyCommission'] }
    }
  >(LOCAL_STORAGE_KEYS.onboarding)

  if (!parsed?.completed || !parsed.mode || !parsed.videosPerDay) return null
  if (parsed.answers?.experience && !parsed.answers.monthlyCommission) {
    parsed.answers.monthlyCommission = parsed.answers.experience
  }
  if (!parsed.answers?.monthlyCommission) return null
  return parsed as OnboardingProfile
}

function hasLocalData(snapshot: UserDataSnapshot): boolean {
  return (
    Object.keys(snapshot.trialProgress).length > 0 ||
    snapshot.brandDeals.length > 0 ||
    Object.keys(snapshot.incomeTracker).length > 0 ||
    snapshot.productScoutEntries.length > 0 ||
    snapshot.onboardingProfile !== null ||
    snapshot.sprintEntrySeen ||
    snapshot.welcomeSeen ||
    snapshot.sprintStartSnapshot !== null ||
    snapshot.sprintPreviousSnapshot !== null
  )
}

export function readLocalStorageSnapshot(): UserDataSnapshot {
  const sprintEntrySeen = localStorage.getItem(LOCAL_STORAGE_KEYS.sprintEntrySeen) === 'true'
  const welcomeSeen = localStorage.getItem(LOCAL_STORAGE_KEYS.welcomeSeen) === 'true'

  return {
    trialProgress: readLocalTrialProgress(),
    brandDeals: readLocalBrandDeals(),
    incomeTracker: readLocalIncomeTracker(),
    productScoutEntries: readLocalProductScout(),
    onboardingProfile: readLocalOnboardingProfile(),
    sprintEntrySeen,
    welcomeSeen,
    sprintStartSnapshot: parseSprintSnapshot(readJson(LOCAL_STORAGE_KEYS.sprintStart)),
    sprintPreviousSnapshot: parseSprintSnapshot(readJson(LOCAL_STORAGE_KEYS.sprintPrevious)),
  }
}

export function isLocalStorageMigrated(userId: string): boolean {
  try {
    return localStorage.getItem(migrationFlagKey(userId)) === 'true'
  } catch {
    return false
  }
}

export function markLocalStorageMigrated(userId: string): void {
  localStorage.setItem(migrationFlagKey(userId), 'true')
}

export async function migrateLocalStorageToSupabase(
  client: Client,
  userId: string,
): Promise<void> {
  if (isLocalStorageMigrated(userId)) return

  const local = readLocalStorageSnapshot()
  if (!hasLocalData(local)) {
    markLocalStorageMigrated(userId)
    return
  }

  await Promise.all([
    persistTrialProgress(client, userId, local.trialProgress),
    persistBrandDeals(client, userId, local.brandDeals),
    persistIncomeTracker(client, userId, local.incomeTracker),
    persistProductScoutEntries(client, userId, local.productScoutEntries),
    persistOnboardingState(client, userId, {
      onboardingProfile: local.onboardingProfile,
      sprintEntrySeen: local.sprintEntrySeen,
      welcomeSeen: local.welcomeSeen,
      sprintStartSnapshot: local.sprintStartSnapshot,
      sprintPreviousSnapshot: local.sprintPreviousSnapshot,
    }),
  ])

  markLocalStorageMigrated(userId)
}

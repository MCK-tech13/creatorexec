import type { IncomeTrackerStore } from '../../types/incomeTracker'
import type { OnboardingProfile } from '../../types/onboarding'
import type { BrandDeal } from '../../types/pipeline'
import type { ProductScoutEntry } from '../../types/productScout'
import type { SprintSnapshot } from '../../types/sprintReview'
import type { TrialProgressStore } from '../schedule/trialProgressStorage'

export interface UserDataSnapshot {
  trialProgress: TrialProgressStore
  brandDeals: BrandDeal[]
  incomeTracker: IncomeTrackerStore
  productScoutEntries: ProductScoutEntry[]
  onboardingProfile: OnboardingProfile | null
  sprintEntrySeen: boolean
  welcomeSeen: boolean
  sprintStartSnapshot: SprintSnapshot | null
  sprintPreviousSnapshot: SprintSnapshot | null
}

const EMPTY_SNAPSHOT: UserDataSnapshot = {
  trialProgress: {},
  brandDeals: [],
  incomeTracker: {},
  productScoutEntries: [],
  onboardingProfile: null,
  sprintEntrySeen: false,
  welcomeSeen: false,
  sprintStartSnapshot: null,
  sprintPreviousSnapshot: null,
}

let activeUserId: string | null = null
let snapshot: UserDataSnapshot = { ...EMPTY_SNAPSHOT }

export function isDataStoreReady(): boolean {
  return activeUserId !== null
}

export function getActiveUserId(): string {
  if (!activeUserId) {
    throw new Error('User data store is not initialized')
  }
  return activeUserId
}

export function getUserDataSnapshot(): UserDataSnapshot {
  if (!activeUserId) {
    return { ...EMPTY_SNAPSHOT }
  }
  return snapshot
}

export function hydrateDataStore(userId: string, data: UserDataSnapshot): void {
  activeUserId = userId
  snapshot = data
}

export function clearDataStore(): void {
  activeUserId = null
  snapshot = { ...EMPTY_SNAPSHOT }
}

export function updateTrialProgress(store: TrialProgressStore): void {
  snapshot = { ...snapshot, trialProgress: store }
}

export function updateBrandDeals(deals: BrandDeal[]): void {
  snapshot = { ...snapshot, brandDeals: deals }
}

export function updateIncomeTracker(store: IncomeTrackerStore): void {
  snapshot = { ...snapshot, incomeTracker: store }
}

export function updateProductScoutEntries(entries: ProductScoutEntry[]): void {
  snapshot = { ...snapshot, productScoutEntries: entries }
}

export function updateOnboardingProfile(profile: OnboardingProfile | null): void {
  snapshot = { ...snapshot, onboardingProfile: profile }
}

export function updateSprintEntrySeen(seen: boolean): void {
  snapshot = { ...snapshot, sprintEntrySeen: seen }
}

export function updateWelcomeSeen(seen: boolean): void {
  snapshot = { ...snapshot, welcomeSeen: seen }
}

export function updateSprintStartSnapshot(value: SprintSnapshot | null): void {
  snapshot = { ...snapshot, sprintStartSnapshot: value }
}

export function updateSprintPreviousSnapshot(value: SprintSnapshot | null): void {
  snapshot = { ...snapshot, sprintPreviousSnapshot: value }
}

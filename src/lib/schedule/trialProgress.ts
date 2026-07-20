import type { MergedProduct } from '../../types'
import { TIER_REVIEW_VIDEO_COUNT } from '../../types'
import {
  getTrialVideosFilmed,
  hasTrialProgressEntry,
  isTrialComplete,
  loadTrialProgress,
  remainingTrialSlots,
  saveTrialProgress,
  setTrialVideosFilmed,
  trialStorageKey,
  type TrialProgressStore,
} from './trialProgressStorage'

export { isTrialComplete, remainingTrialSlots } from './trialProgressStorage'

/** Max Test products that can reserve trial slots in a single sprint. */
export const MAX_ACTIVE_TRIAL_PRODUCTS_PER_SPRINT = 6

/** Favorites first (soft priority), then commission descending. */
export function compareTrialPriority(a: MergedProduct, b: MergedProduct): number {
  const favoriteDelta = Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite))
  if (favoriteDelta !== 0) return favoriteDelta
  return b.commission - a.commission
}

function applyTrialHydration(
  product: MergedProduct,
  store: TrialProgressStore,
): { videosFilmed: number; store: TrialProgressStore; dirty: boolean } {
  const key = trialStorageKey(product)
  const storedEntry = store[key]
  const hasStored = hasTrialProgressEntry(product, store)

  // Clear legacy auto-complete that wrongly marked Test-tier products at 6.
  if (
    hasStored &&
    product.tier === 'Test' &&
    storedEntry?.videosFilmed === TIER_REVIEW_VIDEO_COUNT &&
    storedEntry?.source !== 'manual'
  ) {
    const { [key]: _removed, ...rest } = store
    return {
      videosFilmed: Math.max(product.videosFilmed ?? 0, 0),
      store: rest,
      dirty: true,
    }
  }

  // Proven sellers (non-Test) with commission history skip the in-app trial.
  // Test-tier products still need trials even when they have small sales (itemsSold ≤ 2).
  if (
    !hasStored &&
    product.commission > 0 &&
    product.tier !== 'Test'
  ) {
    const videosFilmed = Math.max(product.videosFilmed ?? 0, TIER_REVIEW_VIDEO_COUNT)
    return {
      videosFilmed,
      store: {
        ...store,
        [key]: { videosFilmed: TIER_REVIEW_VIDEO_COUNT, source: 'sales-history' },
      },
      dirty: true,
    }
  }

  const persisted = getTrialVideosFilmed(product, store)
  return {
    videosFilmed: Math.max(product.videosFilmed ?? 0, persisted),
    store,
    dirty: false,
  }
}

export function hydrateProductTrialProgress(
  product: MergedProduct,
  store: TrialProgressStore = loadTrialProgress(),
  options?: { persist?: boolean },
): MergedProduct {
  const { videosFilmed, store: nextStore, dirty } = applyTrialHydration(product, store)
  if (dirty && options?.persist !== false) {
    saveTrialProgress(nextStore)
  }
  return { ...product, videosFilmed }
}

export function hydrateProductsTrialProgress(
  products: MergedProduct[],
  store: TrialProgressStore = loadTrialProgress(),
  options?: { persist?: boolean },
): MergedProduct[] {
  let currentStore = { ...store }
  let dirty = false

  const hydrated = products.map((product) => {
    const result = applyTrialHydration(product, currentStore)
    currentStore = result.store
    dirty = dirty || result.dirty
    return { ...product, videosFilmed: result.videosFilmed }
  })

  if (dirty && options?.persist !== false) {
    saveTrialProgress(currentStore)
  }

  return hydrated
}

/** Test products still accumulating toward their 6-video trial. */
export function activeTrialTestProducts(products: MergedProduct[]): MergedProduct[] {
  return products.filter(
    (product) => product.tier === 'Test' && !isTrialComplete(product.videosFilmed),
  )
}

/**
 * Top Test products that may reserve trial slots this sprint.
 * Order: favorites first, then commission (deadline placement stays separate).
 */
export function selectActiveTrialProducts(tests: MergedProduct[]): MergedProduct[] {
  return [...tests]
    .filter((product) => product.tier === 'Test' && !isTrialComplete(product.videosFilmed))
    .sort(compareTrialPriority)
    .slice(0, MAX_ACTIVE_TRIAL_PRODUCTS_PER_SPRINT)
}

export interface TrialSchedulingSummary {
  totalTestTier: number
  incompleteTrials: number
  trialComplete: number
  cappedForSprint: number
  selectedProductIds: string[]
}

/** Count how many Test products are eligible vs capped for trial scheduling. */
export function summarizeTrialScheduling(products: MergedProduct[]): TrialSchedulingSummary {
  const testTier = products.filter((product) => product.tier === 'Test')
  const incomplete = testTier.filter((product) => !isTrialComplete(product.videosFilmed))
  const selected = selectActiveTrialProducts(incomplete)

  return {
    totalTestTier: testTier.length,
    incompleteTrials: incomplete.length,
    trialComplete: testTier.length - incomplete.length,
    cappedForSprint: selected.length,
    selectedProductIds: selected.map((product) => product.id),
  }
}

export function persistProductVideosFilmed(product: MergedProduct, videosFilmed: number): void {
  setTrialVideosFilmed(product, videosFilmed)
}

/**
 * Explicit opt-in: creator already tested this product before CreatorExec.
 * Completes the 6-video trial so the product is tiered from CSV sales data
 * instead of being held in Test for a guaranteed trial.
 */
export function markProductAlreadyTested(product: MergedProduct): void {
  setTrialVideosFilmed(product, TIER_REVIEW_VIDEO_COUNT)
}

export function totalTestSlotsNeeded(tests: MergedProduct[]): number {
  return selectActiveTrialProducts(tests).reduce(
    (sum, product) => sum + remainingTrialSlots(product.videosFilmed),
    0,
  )
}

export function testSlotsForProduct(product: MergedProduct): number {
  if (product.tier !== 'Test' || isTrialComplete(product.videosFilmed)) {
    return 0
  }
  return remainingTrialSlots(product.videosFilmed)
}

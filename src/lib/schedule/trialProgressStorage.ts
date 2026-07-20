import { TIER_REVIEW_VIDEO_COUNT } from '../../types'
import { getUserDataSnapshot, updateTrialProgress } from '../supabase/dataStore'
import { scheduleTrialProgressPersist } from '../supabase/sync'

export interface TrialProgressEntry {
  videosFilmed: number
  source?: 'sales-history' | 'manual'
}

export type TrialProgressStore = Record<string, TrialProgressEntry>

const SENTINEL_PRODUCT_IDS = new Set(['sample', 'manual', ''])

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

/**
 * Prefer durable catalog UUID (`product.id`). Fall back to TikTok `productId`
 * for legacy CSV rows that still use non-UUID merged ids. Ignore sentinels.
 */
export function trialStorageKey(product: { id: string; productId: string }): string {
  if (isUuid(product.id)) return product.id
  if (product.productId && !SENTINEL_PRODUCT_IDS.has(product.productId)) {
    return product.productId
  }
  return product.id
}

export function isTrialComplete(videosFilmed: number): boolean {
  return videosFilmed >= TIER_REVIEW_VIDEO_COUNT
}

export function remainingTrialSlots(videosFilmed: number): number {
  return Math.max(0, TIER_REVIEW_VIDEO_COUNT - Math.max(0, videosFilmed))
}

export function loadTrialProgress(): TrialProgressStore {
  return getUserDataSnapshot().trialProgress
}

export function saveTrialProgress(store: TrialProgressStore): void {
  updateTrialProgress(store)
  scheduleTrialProgressPersist()
}

export function hasTrialProgressEntry(
  product: { id: string; productId: string },
  store: TrialProgressStore = loadTrialProgress(),
): boolean {
  return trialStorageKey(product) in store
}

export function getTrialVideosFilmed(
  product: { id: string; productId: string },
  store: TrialProgressStore = loadTrialProgress(),
): number {
  return store[trialStorageKey(product)]?.videosFilmed ?? 0
}

export function setTrialVideosFilmed(
  product: { id: string; productId: string },
  videosFilmed: number,
): void {
  const store = loadTrialProgress()
  const key = trialStorageKey(product)
  const normalized = Math.max(0, videosFilmed)
  store[key] = { videosFilmed: normalized, source: 'manual' }
  saveTrialProgress(store)
}

export function clearTrialProgress(): void {
  saveTrialProgress({})
}

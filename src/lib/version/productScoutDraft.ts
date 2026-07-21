import type { ProductScoutMetrics } from '../../types/productScout'

const DRAFT_KEY = 'ce-product-scout-draft'

export interface ProductScoutDraft {
  productName: string
  metrics: ProductScoutMetrics
  mode: 'new' | 'edit'
  editId?: string
  savedAt: string
}

/** Allows ProductScout to re-consume after a newer autosave (StrictMode-safe). */
let draftConsumptionEpoch = 0
let lastConsumedEpoch = -1
let lastConsumedDraft: ProductScoutDraft | null = null

export function saveProductScoutDraft(draft: Omit<ProductScoutDraft, 'savedAt'>): void {
  try {
    const payload: ProductScoutDraft = {
      ...draft,
      savedAt: new Date().toISOString(),
    }
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
    // New draft bytes → next mount may consume again (focus reload / remount).
    draftConsumptionEpoch += 1
  } catch {
    // sessionStorage may be unavailable (private mode quotas) — proceed anyway
  }
}

export function loadProductScoutDraft(): ProductScoutDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ProductScoutDraft
  } catch {
    return null
  }
}

export function clearProductScoutDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // ignore
  }
}

/**
 * StrictMode-safe draft take: the same in-memory draft is returned for a double
 * mount, but a newer autosave (bumped epoch) is eligible again.
 */
export function takeProductScoutDraft(): ProductScoutDraft | null {
  if (lastConsumedEpoch === draftConsumptionEpoch) {
    return lastConsumedDraft
  }

  const draft = loadProductScoutDraft()
  if (draft) clearProductScoutDraft()
  lastConsumedDraft = draft
  lastConsumedEpoch = draftConsumptionEpoch
  return draft
}

import type { ProductScoutMetrics } from '../../types/productScout'

const DRAFT_KEY = 'ce-product-scout-draft'

export interface ProductScoutDraft {
  productName: string
  metrics: ProductScoutMetrics
  mode: 'new' | 'edit'
  editId?: string
  savedAt: string
}

export function saveProductScoutDraft(draft: Omit<ProductScoutDraft, 'savedAt'>): void {
  try {
    const payload: ProductScoutDraft = {
      ...draft,
      savedAt: new Date().toISOString(),
    }
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
  } catch {
    // sessionStorage may be unavailable (private mode quotas) — proceed with reload anyway
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

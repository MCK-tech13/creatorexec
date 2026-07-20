import type { MergedProduct } from '../../types'
import { persistProductVideosFilmed } from './trialProgress'

/** Deadline / retainer rows are not durable catalog trial products. */
export function isDurableTrialProductKey(productKey: string): boolean {
  return (
    Boolean(productKey) &&
    !productKey.startsWith('deadline:') &&
    !productKey.startsWith('retainer:')
  )
}

/**
 * Apply ±1 from a schedule filming checkmark onto in-memory products.
 * Returns the updated list and the product that changed (for persistence).
 */
export function applyScheduleFilmedDelta(
  products: MergedProduct[],
  productKey: string,
  delta: 1 | -1,
): { products: MergedProduct[]; changed: MergedProduct | null } {
  if (!isDurableTrialProductKey(productKey)) {
    return { products, changed: null }
  }

  const index = products.findIndex((product) => product.id === productKey)
  if (index < 0) return { products, changed: null }

  const current = products[index]
  const videosFilmed = Math.max(0, (current.videosFilmed ?? 0) + delta)
  if (videosFilmed === current.videosFilmed) {
    return { products, changed: null }
  }

  const changed: MergedProduct = { ...current, videosFilmed }
  const next = [...products]
  next[index] = changed
  return { products: next, changed }
}

/** Persist schedule filming into durable trial_progress immediately. */
export function persistScheduleFilmedDelta(
  products: MergedProduct[],
  productKey: string,
  delta: 1 | -1,
): MergedProduct[] {
  const { products: next, changed } = applyScheduleFilmedDelta(products, productKey, delta)
  if (changed) {
    persistProductVideosFilmed(changed, changed.videosFilmed)
  }
  return next
}

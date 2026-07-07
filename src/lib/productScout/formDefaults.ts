import type { ProductScoutEntry, ProductScoutMetrics } from '../../types/productScout'

export const EMPTY_PRODUCT_SCOUT_METRICS: ProductScoutMetrics = {
  orders: { value: '', delta: '' },
  ctr: { value: '', delta: '' },
  creators: { value: '', delta: '' },
  atcUsers: { value: '', delta: '' },
}

export function entryToFormDefaults(entry: ProductScoutEntry) {
  return {
    initialName: entry.productName,
    initialMetrics: entry.metrics,
  }
}

import type {
  MetricInput,
  ProductScoutEntry,
  ProductScoutMetrics,
  ProductScoutRecent7dMetrics,
} from '../../types/productScout'

export const EMPTY_METRIC_INPUT: MetricInput = { value: '', delta: '' }

export const EMPTY_PRODUCT_SCOUT_RECENT_7D: ProductScoutRecent7dMetrics = {
  orders: { ...EMPTY_METRIC_INPUT },
  atcUsers: { ...EMPTY_METRIC_INPUT },
  creators: { ...EMPTY_METRIC_INPUT },
}

export const EMPTY_PRODUCT_SCOUT_METRICS: ProductScoutMetrics = {
  orders: { ...EMPTY_METRIC_INPUT },
  ctr: { ...EMPTY_METRIC_INPUT },
  creators: { ...EMPTY_METRIC_INPUT },
  atcUsers: { ...EMPTY_METRIC_INPUT },
}

function asMetricInput(raw: unknown): MetricInput {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_METRIC_INPUT }
  const row = raw as Record<string, unknown>
  return {
    value: typeof row.value === 'string' ? row.value : '',
    delta: typeof row.delta === 'string' ? row.delta : '',
  }
}

/** Normalize persisted JSON (legacy rows without recent7d stay valid). */
export function normalizeProductScoutMetrics(raw: unknown): ProductScoutMetrics {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_PRODUCT_SCOUT_METRICS }
  }
  const row = raw as Record<string, unknown>
  const recentRaw = row.recent7d
  let recent7d: ProductScoutRecent7dMetrics | undefined
  if (recentRaw && typeof recentRaw === 'object') {
    const recent = recentRaw as Record<string, unknown>
    recent7d = {
      orders: asMetricInput(recent.orders),
      atcUsers: asMetricInput(recent.atcUsers),
      creators: asMetricInput(recent.creators),
    }
    const hasAny =
      recent7d.orders.value.trim() !== '' ||
      recent7d.orders.delta.trim() !== '' ||
      recent7d.atcUsers.value.trim() !== '' ||
      recent7d.atcUsers.delta.trim() !== '' ||
      recent7d.creators.value.trim() !== '' ||
      recent7d.creators.delta.trim() !== ''
    if (!hasAny) recent7d = undefined
  }

  return {
    orders: asMetricInput(row.orders),
    ctr: asMetricInput(row.ctr),
    creators: asMetricInput(row.creators),
    atcUsers: asMetricInput(row.atcUsers),
    ...(recent7d ? { recent7d } : {}),
  }
}

export function entryToFormDefaults(entry: ProductScoutEntry) {
  return {
    initialName: entry.productName,
    initialMetrics: normalizeProductScoutMetrics(entry.metrics),
  }
}

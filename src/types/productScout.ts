export type ProductScoutVerdict = 'strong' | 'test' | 'pass' | 'insufficient'

export type SignalSentiment = 'positive' | 'neutral' | 'negative' | 'muted'

export interface MetricInput {
  value: string
  delta: string
}

/** Optional 7-day orders / ATC / creators window for recent overlays. */
export interface ProductScoutRecent7dMetrics {
  orders: MetricInput
  atcUsers: MetricInput
  creators: MetricInput
}

export interface ProductScoutMetrics {
  orders: MetricInput
  ctr: MetricInput
  creators: MetricInput
  atcUsers: MetricInput
  /**
   * Optional 7-day screenshot/fields. Absent or empty → score identical to
   * 30-day-only behavior.
   */
  recent7d?: ProductScoutRecent7dMetrics
}

export interface ParsedMetric {
  value: number
  delta: number
}

export interface ProductScoutSignal {
  id: string
  label: string
  detail: string
  points: number
  sentiment: SignalSentiment
  /** When false, signal is shown but excluded from total score (missing input). */
  countsTowardScore: boolean
  /** Non-blocking warning banner shown on the signal card (does not change points). */
  warning?: string
}

export interface ProductScoutFunnelRecommendation {
  headline: string
  detail: string
}

export interface ProductScoutScoreResult {
  atcConversionRate: number | null
  signals: ProductScoutSignal[]
  totalScore: number
  scoredSignalCount: number
  verdict: ProductScoutVerdict
  verdictLabel: string
  funnel: ProductScoutFunnelRecommendation
}

export interface ProductScoutEntry {
  id: string
  productName: string
  metrics: ProductScoutMetrics
  createdAt: string
  updatedAt: string
}

export interface ProductScoutEntryInsert {
  productName: string
  metrics: ProductScoutMetrics
}

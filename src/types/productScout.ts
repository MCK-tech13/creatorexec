export type ProductScoutVerdict = 'strong' | 'test' | 'pass'

export type SignalSentiment = 'positive' | 'neutral' | 'negative' | 'muted'

export interface MetricInput {
  value: string
  delta: string
}

export interface ProductScoutMetrics {
  orders: MetricInput
  ctr: MetricInput
  creators: MetricInput
  atcUsers: MetricInput
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
}

export interface ProductScoutFunnelRecommendation {
  headline: string
  detail: string
}

export interface ProductScoutScoreResult {
  atcConversionRate: number | null
  signals: ProductScoutSignal[]
  totalScore: number
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

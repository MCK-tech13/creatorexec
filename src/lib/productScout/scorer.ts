import { parseTrendDelta, parseTrendValue } from './metricParser'
import type {
  ParsedMetric,
  ProductScoutFunnelRecommendation,
  ProductScoutMetrics,
  ProductScoutScoreResult,
  ProductScoutSignal,
  ProductScoutVerdict,
} from '../../types/productScout'

function parseMetricPair(input: { value: string; delta: string }, isPercent = false): ParsedMetric | null {
  const value = parseTrendValue(input.value)
  const delta = parseTrendDelta(input.delta, isPercent)
  if (value === null || delta === null) return null
  return { value, delta }
}

function verdictFromScore(score: number): { verdict: ProductScoutVerdict; label: string } {
  if (score >= 4) {
    return { verdict: 'strong', label: 'Strong opportunity' }
  }
  if (score >= 0) {
    return { verdict: 'test', label: 'Worth testing' }
  }
  return { verdict: 'pass', label: 'Pass' }
}

function funnelRecommendation(creatorCount: number): ProductScoutFunnelRecommendation {
  if (creatorCount < 500) {
    return {
      headline: 'Lead with TOF — claim the hook space early',
      detail: 'Low creator count means the hook angle is still open. Film top-of-funnel discovery content first, then move into MOF quickly while demand is building.',
    }
  }
  if (creatorCount >= 2_000) {
    return {
      headline: 'Skip to BOF / live content',
      detail: 'This product is crowded — most competitors stop at TOF/MOF. Direct-sell and live content is the open gap, even on saturated products.',
    }
  }
  return {
    headline: 'MOF first, then layer in BOF',
    detail: 'Moderate competition. Focus on mid-funnel content that pushes add-to-cart to order conversion, then add bottom-of-funnel proof and urgency.',
  }
}

function scoreOrdersTrend(orders: ParsedMetric): ProductScoutSignal {
  if (orders.delta > 0) {
    return {
      id: 'orders-trend',
      label: 'Orders trend',
      detail: 'Rising orders — demand is growing',
      points: 2,
      sentiment: 'positive',
    }
  }
  if (orders.delta < 0) {
    return {
      id: 'orders-trend',
      label: 'Orders trend',
      detail: 'Falling orders — demand is cooling',
      points: -2,
      sentiment: 'negative',
    }
  }
  return {
    id: 'orders-trend',
    label: 'Orders trend',
    detail: 'Orders are flat — no clear demand shift',
    points: 0,
    sentiment: 'neutral',
  }
}

function scoreCreatorsLevel(creators: ParsedMetric): ProductScoutSignal {
  if (creators.value < 200) {
    return {
      id: 'creators-level',
      label: 'Creator competition',
      detail: 'Under 200 creators — low competition',
      points: 2,
      sentiment: 'positive',
    }
  }
  if (creators.value < 2_000) {
    return {
      id: 'creators-level',
      label: 'Creator competition',
      detail: 'Moderate creator count — competitive but workable',
      points: 0,
      sentiment: 'neutral',
    }
  }
  return {
    id: 'creators-level',
    label: 'Creator competition',
    detail: '2,000+ creators — crowded market',
    points: -1,
    sentiment: 'negative',
  }
}

function scoreCreatorSaturation(creators: ParsedMetric, orders: ParsedMetric): ProductScoutSignal | null {
  const creatorsClimbing = creators.delta > 0
  const ordersFlatOrFalling = orders.delta <= 0
  if (!creatorsClimbing || !ordersFlatOrFalling) return null

  return {
    id: 'creator-saturation',
    label: 'Market saturation',
    detail: 'Creators climbing while orders stall — market is saturating',
    points: -2,
    sentiment: 'negative',
  }
}

function scoreCtr(ctr: ParsedMetric, creators: ParsedMetric): ProductScoutSignal[] {
  const signals: ProductScoutSignal[] = []

  if (ctr.value >= 4) {
    signals.push({
      id: 'ctr-strength',
      label: 'CTR hook',
      detail: '4%+ CTR — strong scroll-stopping hook',
      points: 2,
      sentiment: 'positive',
    })
  } else {
    signals.push({
      id: 'ctr-strength',
      label: 'CTR hook',
      detail: 'CTR below 4% — hook may need work',
      points: 0,
      sentiment: 'neutral',
    })
  }

  if (ctr.delta < 0 && creators.value >= 2_000) {
    signals.push({
      id: 'ctr-fatigue',
      label: 'Content fatigue',
      detail: 'Declining CTR with high creator count — audience may be tired of this angle',
      points: -2,
      sentiment: 'negative',
    })
  }

  return signals
}

function scoreAtcConversion(conversionRate: number): ProductScoutSignal {
  if (conversionRate >= 20) {
    return {
      id: 'atc-conversion',
      label: 'ATC → order conversion',
      detail: '20%+ conversion — product converts well after interest',
      points: 2,
      sentiment: 'positive',
    }
  }
  if (conversionRate < 8) {
    return {
      id: 'atc-conversion',
      label: 'ATC → order conversion',
      detail: 'Under 8% conversion — friction in price, trust, checkout, or buyer split',
      points: -2,
      sentiment: 'negative',
    }
  }
  return {
    id: 'atc-conversion',
    label: 'ATC → order conversion',
    detail: 'Moderate conversion — room to optimize checkout path',
    points: 0,
    sentiment: 'neutral',
  }
}

export function scoreProductScout(metrics: ProductScoutMetrics): ProductScoutScoreResult | null {
  const orders = parseMetricPair(metrics.orders)
  const ctr = parseMetricPair(metrics.ctr, true)
  const creators = parseMetricPair(metrics.creators)
  const atcUsers = parseMetricPair(metrics.atcUsers)

  if (!orders || !ctr || !creators || !atcUsers) return null
  if (atcUsers.value <= 0) return null

  const atcConversionRate = (orders.value / atcUsers.value) * 100

  const signals: ProductScoutSignal[] = [
    scoreOrdersTrend(orders),
    scoreCreatorsLevel(creators),
  ]

  const saturation = scoreCreatorSaturation(creators, orders)
  if (saturation) signals.push(saturation)

  signals.push(...scoreCtr(ctr, creators))
  signals.push(scoreAtcConversion(atcConversionRate))

  const totalScore = signals.reduce((sum, signal) => sum + signal.points, 0)
  const { verdict, label } = verdictFromScore(totalScore)

  return {
    atcConversionRate,
    signals,
    totalScore,
    verdict,
    verdictLabel: label,
    funnel: funnelRecommendation(creators.value),
  }
}

export function isValidProductScoutMetrics(metrics: ProductScoutMetrics): boolean {
  return scoreProductScout(metrics) !== null
}

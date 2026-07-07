import { parseCompactNumber, parseDelta } from './metricParser'
import type {
  ProductScoutFunnelRecommendation,
  ProductScoutMetrics,
  ProductScoutScoreResult,
  ProductScoutSignal,
  ProductScoutVerdict,
} from '../../types/productScout'

interface ParsedScoutMetrics {
  orders: number | null
  ordersDelta: number | null
  ctr: number | null
  ctrDelta: number | null
  creators: number | null
  creatorsDelta: number | null
  atcUsers: number | null
}

function parseScoutMetrics(metrics: ProductScoutMetrics): ParsedScoutMetrics {
  return {
    orders: parseCompactNumber(metrics.orders.value),
    ordersDelta: parseDelta(metrics.orders.delta),
    ctr: parseCompactNumber(metrics.ctr.value),
    ctrDelta: parseDelta(metrics.ctr.delta),
    creators: parseCompactNumber(metrics.creators.value),
    creatorsDelta: parseDelta(metrics.creators.delta),
    atcUsers: parseCompactNumber(metrics.atcUsers.value),
  }
}

export function hasProductScoutData(metrics: ProductScoutMetrics): boolean {
  const parsed = parseScoutMetrics(metrics)
  return [parsed.orders, parsed.ctr, parsed.creators, parsed.atcUsers].some((v) => v != null)
}

function scoreOrdersTrend(ordersDelta: number | null): ProductScoutSignal {
  if (ordersDelta == null) {
    return {
      id: 'orders-trend',
      label: 'Orders Trend',
      detail: 'No data',
      points: 0,
      sentiment: 'muted',
    }
  }
  if (ordersDelta > 0) {
    return {
      id: 'orders-trend',
      label: 'Orders Trend',
      detail: 'Orders rising — demand is healthy',
      points: 2,
      sentiment: 'positive',
    }
  }
  return {
    id: 'orders-trend',
    label: 'Orders Trend',
    detail: 'Orders falling — demand may be cooling',
    points: -2,
    sentiment: 'negative',
  }
}

function scoreCreatorSaturation(
  creatorLevel: number | null,
  creatorDelta: number | null,
  ordersDelta: number | null,
): ProductScoutSignal {
  if (creatorLevel == null) {
    return {
      id: 'creator-saturation',
      label: 'Creator Saturation',
      detail: 'No data',
      points: 0,
      sentiment: 'muted',
    }
  }

  const climbingWhileOrdersFlat =
    creatorDelta != null && creatorDelta > 0 && ordersDelta != null && ordersDelta <= 0

  if (climbingWhileOrdersFlat) {
    return {
      id: 'creator-saturation',
      label: 'Creator Saturation',
      detail: "Creators climbing while orders aren't — product is saturating",
      points: -2,
      sentiment: 'negative',
    }
  }

  if (creatorLevel < 200) {
    return {
      id: 'creator-saturation',
      label: 'Creator Saturation',
      detail: 'Low competition (<200 creators)',
      points: 2,
      sentiment: 'positive',
    }
  }
  if (creatorLevel < 2_000) {
    return {
      id: 'creator-saturation',
      label: 'Creator Saturation',
      detail: 'Moderate competition (<2,000 creators)',
      points: 0,
      sentiment: 'neutral',
    }
  }
  return {
    id: 'creator-saturation',
    label: 'Creator Saturation',
    detail: 'Crowded (2,000+ creators)',
    points: -1,
    sentiment: 'negative',
  }
}

function scoreCtr(
  ctrValue: number | null,
  ctrDelta: number | null,
  creatorLevel: number | null,
): ProductScoutSignal {
  if (ctrValue == null) {
    return {
      id: 'ctr-hook',
      label: 'CTR / Hook Strength',
      detail: 'No data',
      points: 0,
      sentiment: 'muted',
    }
  }

  const highCreatorCount = creatorLevel != null && creatorLevel >= 2_000
  const decliningCtr = ctrDelta != null && ctrDelta < 0

  if (decliningCtr && highCreatorCount) {
    return {
      id: 'ctr-hook',
      label: 'CTR / Hook Strength',
      detail: 'CTR declining + high creator count — content fatigue',
      points: -2,
      sentiment: 'negative',
    }
  }

  if (ctrValue >= 4) {
    return {
      id: 'ctr-hook',
      label: 'CTR / Hook Strength',
      detail: 'Strong hook (CTR ≥ 4%)',
      points: 2,
      sentiment: 'positive',
    }
  }

  return {
    id: 'ctr-hook',
    label: 'CTR / Hook Strength',
    detail: 'CTR below 4% — average hook strength',
    points: 0,
    sentiment: 'neutral',
  }
}

function scoreConversion(orders: number | null, atcUsers: number | null): ProductScoutSignal {
  if (orders == null || atcUsers == null || atcUsers === 0) {
    return {
      id: 'atc-conversion',
      label: 'ATC-to-Order Conversion',
      detail: 'No data',
      points: 0,
      sentiment: 'muted',
    }
  }

  const rate = orders / atcUsers
  const ratePercent = (rate * 100).toFixed(1)

  if (rate >= 0.2) {
    return {
      id: 'atc-conversion',
      label: 'ATC-to-Order Conversion',
      detail: `Converting well (${ratePercent}% ATC-to-order)`,
      points: 2,
      sentiment: 'positive',
    }
  }
  if (rate < 0.08) {
    return {
      id: 'atc-conversion',
      label: 'ATC-to-Order Conversion',
      detail: `High friction (${ratePercent}% ATC-to-order) — price, trust, checkout, or too many creators splitting buyers`,
      points: -2,
      sentiment: 'negative',
    }
  }
  return {
    id: 'atc-conversion',
    label: 'ATC-to-Order Conversion',
    detail: `Moderate conversion (${ratePercent}% ATC-to-order)`,
    points: 0,
    sentiment: 'neutral',
  }
}

function verdictFromScore(totalScore: number): { verdict: ProductScoutVerdict; label: string } {
  if (totalScore >= 4) {
    return { verdict: 'strong', label: 'Strong opportunity' }
  }
  if (totalScore >= 0) {
    return { verdict: 'test', label: 'Worth testing' }
  }
  return { verdict: 'pass', label: 'Pass' }
}

function funnelRecommendation(creatorLevel: number | null): ProductScoutFunnelRecommendation {
  if (creatorLevel == null) {
    return {
      headline: 'Add creator count to see funnel recommendation',
      detail: '',
    }
  }
  if (creatorLevel < 500) {
    return {
      headline: 'Lead TOF, then MOF fast',
      detail:
        'Low competition — claim the hook space early, then follow up with mid-funnel content quickly before others catch on.',
    }
  }
  if (creatorLevel >= 2_000) {
    return {
      headline: 'Skip to BOF / live',
      detail:
        'Most competitors stop at TOF/MOF on crowded products — direct-sell content is the open gap even here.',
    }
  }
  return {
    headline: 'MOF first, then layer BOF',
    detail:
      'Moderate competition — push ATC-to-order conversion with mid-funnel content, then add bottom-funnel direct-sell.',
  }
}

export function scoreProductScout(metrics: ProductScoutMetrics): ProductScoutScoreResult | null {
  if (!hasProductScoutData(metrics)) return null

  const parsed = parseScoutMetrics(metrics)

  const signals: ProductScoutSignal[] = [
    scoreOrdersTrend(parsed.ordersDelta),
    scoreCreatorSaturation(parsed.creators, parsed.creatorsDelta, parsed.ordersDelta),
    scoreCtr(parsed.ctr, parsed.ctrDelta, parsed.creators),
    scoreConversion(parsed.orders, parsed.atcUsers),
  ]

  const totalScore = signals.reduce((sum, signal) => sum + signal.points, 0)
  const { verdict, label } = verdictFromScore(totalScore)

  const atcConversionRate =
    parsed.orders != null && parsed.atcUsers != null && parsed.atcUsers > 0
      ? (parsed.orders / parsed.atcUsers) * 100
      : null

  return {
    atcConversionRate,
    signals,
    totalScore,
    verdict,
    verdictLabel: label,
    funnel: funnelRecommendation(parsed.creators),
  }
}

/** @deprecated Use hasProductScoutData */
export function isValidProductScoutMetrics(metrics: ProductScoutMetrics): boolean {
  return hasProductScoutData(metrics)
}

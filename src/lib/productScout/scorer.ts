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

function noDataSignal(
  id: string,
  label: string,
  detail = 'No data — not counted in score',
): ProductScoutSignal {
  return {
    id,
    label,
    detail,
    points: 0,
    sentiment: 'muted',
    countsTowardScore: false,
  }
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
    return noDataSignal('orders-trend', 'Orders Trend', 'No trend data — add an orders delta to score demand direction')
  }
  if (ordersDelta > 0) {
    return {
      id: 'orders-trend',
      label: 'Orders Trend',
      detail: 'Orders rising — demand is healthy',
      points: 1,
      sentiment: 'positive',
      countsTowardScore: true,
    }
  }
  return {
    id: 'orders-trend',
    label: 'Orders Trend',
    detail: 'Orders falling — demand may be cooling',
    points: -2,
    sentiment: 'negative',
    countsTowardScore: true,
  }
}

function scoreCreatorSaturation(
  creatorLevel: number | null,
  creatorDelta: number | null,
  ordersDelta: number | null,
  conversionRate: number | null,
): ProductScoutSignal {
  if (creatorLevel == null) {
    return noDataSignal('creator-saturation', 'Creator Saturation')
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
      countsTowardScore: true,
    }
  }

  if (creatorLevel < 200) {
    return {
      id: 'creator-saturation',
      label: 'Creator Saturation',
      detail: 'Low competition (<200 creators)',
      points: 2,
      sentiment: 'positive',
      countsTowardScore: true,
    }
  }
  if (creatorLevel < 2_000) {
    return {
      id: 'creator-saturation',
      label: 'Creator Saturation',
      detail: 'Moderate competition (<2,000 creators)',
      points: 0,
      sentiment: 'neutral',
      countsTowardScore: true,
    }
  }

  const healthyConversion = conversionRate != null && conversionRate >= 0.08
  const ordersRising = ordersDelta != null && ordersDelta > 0

  if (healthyConversion && ordersRising) {
    return {
      id: 'creator-saturation',
      label: 'Creator Saturation',
      detail: 'Crowded (2,000+ creators) but orders are rising and conversion is healthy',
      points: 0,
      sentiment: 'neutral',
      countsTowardScore: true,
    }
  }

  if (healthyConversion && ordersDelta == null) {
    return {
      id: 'creator-saturation',
      label: 'Creator Saturation',
      detail: 'Crowded (2,000+ creators) with healthy conversion — add an orders trend to refine this',
      points: -1,
      sentiment: 'neutral',
      countsTowardScore: true,
    }
  }

  return {
    id: 'creator-saturation',
    label: 'Creator Saturation',
    detail: 'Crowded (2,000+ creators)',
    points: -1,
    sentiment: 'negative',
    countsTowardScore: true,
  }
}

function scoreCtr(
  ctrValue: number | null,
  ctrDelta: number | null,
  creatorLevel: number | null,
): ProductScoutSignal {
  if (ctrValue == null) {
    return noDataSignal('ctr-hook', 'CTR / Hook Strength')
  }

  const highCreatorCount = creatorLevel != null && creatorLevel >= 2_000
  const competitiveMarket = creatorLevel != null && creatorLevel >= 500
  const decliningCtr = ctrDelta != null && ctrDelta < 0

  if (decliningCtr && highCreatorCount) {
    return {
      id: 'ctr-hook',
      label: 'CTR / Hook Strength',
      detail: 'CTR declining + high creator count — content fatigue',
      points: -2,
      sentiment: 'negative',
      countsTowardScore: true,
    }
  }

  if (ctrValue >= 4) {
    return {
      id: 'ctr-hook',
      label: 'CTR / Hook Strength',
      detail: 'Strong hook (CTR ≥ 4%)',
      points: 2,
      sentiment: 'positive',
      countsTowardScore: true,
    }
  }

  if (ctrValue < 2.5 && competitiveMarket) {
    return {
      id: 'ctr-hook',
      label: 'CTR / Hook Strength',
      detail: 'Weak hook in a competitive market — hooks are not breaking through',
      points: -1,
      sentiment: 'negative',
      countsTowardScore: true,
    }
  }

  return {
    id: 'ctr-hook',
    label: 'CTR / Hook Strength',
    detail: 'CTR below 4% — average hook strength',
    points: 0,
    sentiment: 'neutral',
    countsTowardScore: true,
  }
}

function scoreConversion(orders: number | null, atcUsers: number | null): ProductScoutSignal {
  if (orders == null || atcUsers == null || atcUsers === 0) {
    return noDataSignal('atc-conversion', 'ATC-to-Order Conversion')
  }

  const rate = orders / atcUsers
  const ratePercent = (rate * 100).toFixed(1)
  const browseToOrderRatio = atcUsers / orders
  const heavyBrowsing = browseToOrderRatio > 15 && rate < 0.08

  if (rate >= 0.2) {
    return {
      id: 'atc-conversion',
      label: 'ATC-to-Order Conversion',
      detail: `Converting well (${ratePercent}% ATC-to-order)`,
      points: 2,
      sentiment: 'positive',
      countsTowardScore: true,
    }
  }
  if (rate < 0.08) {
    const detail = heavyBrowsing
      ? `High friction (${ratePercent}% ATC-to-order) — lots of add-to-carts but few buyers`
      : `High friction (${ratePercent}% ATC-to-order) — price, trust, checkout, or too many creators splitting buyers`

    return {
      id: 'atc-conversion',
      label: 'ATC-to-Order Conversion',
      detail,
      points: heavyBrowsing ? -3 : -2,
      sentiment: 'negative',
      countsTowardScore: true,
    }
  }
  return {
    id: 'atc-conversion',
    label: 'ATC-to-Order Conversion',
    detail: `Moderate conversion (${ratePercent}% ATC-to-order)`,
    points: 0,
    sentiment: 'neutral',
    countsTowardScore: true,
  }
}

function verdictFromScore(totalScore: number): { verdict: ProductScoutVerdict; label: string } {
  if (totalScore >= 5) {
    return { verdict: 'strong', label: 'Strong opportunity' }
  }
  if (totalScore >= 1) {
    return { verdict: 'test', label: 'Worth testing' }
  }
  return { verdict: 'pass', label: 'Pass' }
}

function resolveVerdict(
  totalScore: number,
  parsed: ParsedScoutMetrics,
  conversionRate: number | null,
): { verdict: ProductScoutVerdict; label: string } {
  const base = verdictFromScore(totalScore)

  if (base.verdict !== 'pass') {
    return base
  }

  const ordersTrendMissing = parsed.ordersDelta == null
  const confirmedWeakDemand = parsed.ordersDelta != null && parsed.ordersDelta <= 0
  const confirmedWeakConversion = conversionRate != null && conversionRate < 0.08

  if (ordersTrendMissing && !confirmedWeakDemand && !confirmedWeakConversion) {
    return {
      verdict: 'insufficient',
      label: 'Insufficient data for a confident verdict',
    }
  }

  return base
}

function conversionRate(parsed: ParsedScoutMetrics): number | null {
  if (parsed.orders == null || parsed.atcUsers == null || parsed.atcUsers === 0) {
    return null
  }
  return parsed.orders / parsed.atcUsers
}

function funnelRecommendation(parsed: ParsedScoutMetrics): ProductScoutFunnelRecommendation {
  const { creators, ctr, ctrDelta } = parsed

  if (creators == null) {
    return {
      headline: 'Add creator count to see funnel recommendation',
      detail: '',
    }
  }

  const rate = conversionRate(parsed)
  const decliningCtr = ctrDelta != null && ctrDelta < 0
  const weakCtr = ctr != null && ctr < 3

  if (creators < 500) {
    return {
      headline: 'Lead TOF, then MOF fast',
      detail:
        'Low competition — claim the hook space early, then follow up with mid-funnel content quickly before others catch on.',
    }
  }

  if (creators >= 2_000) {
    if (decliningCtr || weakCtr) {
      return {
        headline: 'Fresh TOF angle first',
        detail:
          'Hooks look tired in a crowded market — differentiated top-of-funnel content is the gap, not more direct-sell.',
      }
    }
    if (rate != null && rate >= 0.2) {
      return {
        headline: 'Skip to BOF / live',
        detail:
          'People are buying despite heavy competition — direct-sell and live content can capture demand that is already converting.',
      }
    }
    if (rate != null && rate < 0.08) {
      return {
        headline: 'MOF first — fix conversion',
        detail:
          'Add-to-cart interest is not turning into orders — build trust, handle objections, and fix conversion before bottom-funnel direct-sell.',
      }
    }
    return {
      headline: 'MOF first, then layer BOF',
      detail:
        'Crowded product with mixed signals — strengthen mid-funnel conversion before layering direct-sell content.',
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
  const rate = conversionRate(parsed)

  const signals: ProductScoutSignal[] = [
    scoreOrdersTrend(parsed.ordersDelta),
    scoreCreatorSaturation(parsed.creators, parsed.creatorsDelta, parsed.ordersDelta, rate),
    scoreCtr(parsed.ctr, parsed.ctrDelta, parsed.creators),
    scoreConversion(parsed.orders, parsed.atcUsers),
  ]

  const scoredSignals = signals.filter((signal) => signal.countsTowardScore)
  const totalScore = scoredSignals.reduce((sum, signal) => sum + signal.points, 0)
  const { verdict, label } = resolveVerdict(totalScore, parsed, rate)

  const atcConversionRate = rate != null ? rate * 100 : null

  return {
    atcConversionRate,
    signals,
    totalScore,
    scoredSignalCount: scoredSignals.length,
    verdict,
    verdictLabel: label,
    funnel: funnelRecommendation(parsed),
  }
}

/** @deprecated Use hasProductScoutData */
export function isValidProductScoutMetrics(metrics: ProductScoutMetrics): boolean {
  return hasProductScoutData(metrics)
}

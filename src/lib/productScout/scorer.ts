import { formatTrendNumber, parseCompactNumber, parseDelta } from './metricParser'
import type {
  ProductScoutFunnelRecommendation,
  ProductScoutMetrics,
  ProductScoutScoreResult,
  ProductScoutSignal,
  ProductScoutVerdict,
} from '../../types/productScout'

/**
 * Bump when Product Scout scoring rules change in a way that affects
 * total_score / verdict for the same metrics input.
 * Persisted on product_scout_list.scoring_logic_version at save time.
 *
 * 2 = creator saturation informational + Orders/ATC growth magnitude tiers
 * 3 = optional 7-day cooling overlay (magnitude-tier penalty vs 30-day growth)
 */
export const SCORING_LOGIC_VERSION = 3

interface ParsedScoutMetrics {
  orders: number | null
  ordersDelta: number | null
  ctr: number | null
  ctrDelta: number | null
  creators: number | null
  creatorsDelta: number | null
  atcUsers: number | null
  atcUsersDelta: number | null
}

/** Points above the base +1 direction score for an upward trend. */
const MAGNITUDE_BONUS_CAP = 2

/**
 * 7-day cooling vs 30-day growth — decline % tiers (easy to tune later).
 * Under NOISE_MAX: ignore as normal noise. Through MILD_MAX: −1. Above: −2.
 */
export const COOLING_DECLINE_NOISE_MAX = 0.15
export const COOLING_DECLINE_MILD_MAX = 0.35

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
    atcUsersDelta: parseDelta(metrics.atcUsers.delta),
  }
}

export function hasProductScoutData(metrics: ProductScoutMetrics): boolean {
  const parsed = parseScoutMetrics(metrics)
  return [parsed.orders, parsed.ctr, parsed.creators, parsed.atcUsers].some((v) => v != null)
}

/**
 * Growth multiple from current level and absolute delta.
 * previous = current - delta; multiple = current / previous.
 * previous === 0 (new product, no baseline) → max tier.
 */
export function growthMultipleFromDelta(
  current: number | null,
  delta: number,
): { multiple: number | null; noBaseline: boolean } {
  if (current == null || !(delta > 0)) {
    return { multiple: null, noBaseline: false }
  }
  const previous = current - delta
  if (previous === 0) {
    return { multiple: null, noBaseline: true }
  }
  if (previous < 0) {
    return { multiple: null, noBaseline: false }
  }
  return { multiple: current / previous, noBaseline: false }
}

/**
 * Decline fraction from current level + negative delta.
 * previous = current - delta; decline = |delta| / previous when previous > 0.
 */
export function declineFractionFromDelta(
  current: number | null,
  delta: number,
): number | null {
  if (current == null || !(delta < 0)) return null
  const previous = current - delta
  if (!(previous > 0)) return null
  return Math.abs(delta) / previous
}

function formatDeclinePercent(fraction: number): string {
  const pct = fraction * 100
  if (pct >= 10 || Number.isInteger(pct)) {
    return `${Math.round(pct)}%`
  }
  return `${pct.toFixed(1).replace(/\.0$/, '')}%`
}

function formatGrowthMultiple(multiple: number): string {
  const rounded = Math.round(multiple * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1)
}

function upwardTrendPoints(
  subject: 'Orders' | 'ATC users',
  current: number | null,
  delta: number,
): { points: number; magnitudeBonus: number; detail: string } {
  const { multiple, noBaseline } = growthMultipleFromDelta(current, delta)

  if (noBaseline) {
    return {
      points: 3,
      magnitudeBonus: 2,
      detail: `${subject} up sharply — new product, no baseline yet.`,
    }
  }

  // Missing value (or unusable previous): direction-only +1
  if (multiple == null) {
    return {
      points: 1,
      magnitudeBonus: 0,
      detail:
        subject === 'Orders'
          ? 'Orders rising — demand is healthy'
          : 'ATC users rising — interest is growing',
    }
  }

  const formatted = formatGrowthMultiple(multiple)

  if (multiple > 5) {
    return {
      points: 3,
      magnitudeBonus: 2,
      detail: `${subject} up ${formatted}x — strong demand surge`,
    }
  }
  if (multiple >= 2) {
    return {
      points: 2,
      magnitudeBonus: 1,
      detail: `${subject} up ${formatted}x — solid demand surge`,
    }
  }
  return {
    points: 1,
    magnitudeBonus: 0,
    detail:
      subject === 'Orders'
        ? `${subject} up ${formatted}x — demand is healthy`
        : `${subject} up ${formatted}x — interest is growing`,
  }
}

function scoreOrdersTrend(orders: number | null, ordersDelta: number | null): ProductScoutSignal {
  if (ordersDelta == null) {
    return noDataSignal(
      'orders-trend',
      'Orders Trend',
      'No trend data — add an orders delta to score demand direction',
    )
  }
  if (ordersDelta > 0) {
    const { points, detail } = upwardTrendPoints('Orders', orders, ordersDelta)
    return {
      id: 'orders-trend',
      label: 'Orders Trend',
      detail,
      points,
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

function scoreAtcTrend(atcUsers: number | null, atcUsersDelta: number | null): ProductScoutSignal {
  if (atcUsersDelta == null) {
    return noDataSignal(
      'atc-trend',
      'ATC Trend',
      'No trend data — add an ATC users delta to score interest direction',
    )
  }
  if (atcUsersDelta > 0) {
    const { points, detail } = upwardTrendPoints('ATC users', atcUsers, atcUsersDelta)
    return {
      id: 'atc-trend',
      label: 'ATC Trend',
      detail,
      points,
      sentiment: 'positive',
      countsTowardScore: true,
    }
  }
  return {
    id: 'atc-trend',
    label: 'ATC Trend',
    detail: 'ATC users falling — interest may be cooling',
    points: -1,
    sentiment: 'negative',
    countsTowardScore: true,
  }
}

/**
 * Cap combined magnitude bonus across Orders + ATC Trend at MAGNITUDE_BONUS_CAP.
 * Larger bonus keeps priority; remainder goes to the other signal. Orders wins ties.
 */
function applyMagnitudeBonusCap(
  ordersSignal: ProductScoutSignal,
  atcSignal: ProductScoutSignal,
): { ordersSignal: ProductScoutSignal; atcSignal: ProductScoutSignal } {
  const ordersBonus =
    ordersSignal.countsTowardScore && ordersSignal.points > 1 ? ordersSignal.points - 1 : 0
  const atcBonus =
    atcSignal.countsTowardScore && atcSignal.points > 1 ? atcSignal.points - 1 : 0

  if (ordersBonus + atcBonus <= MAGNITUDE_BONUS_CAP) {
    return { ordersSignal, atcSignal }
  }

  let keptOrdersBonus: number
  let keptAtcBonus: number

  if (atcBonus > ordersBonus) {
    keptAtcBonus = Math.min(atcBonus, MAGNITUDE_BONUS_CAP)
    keptOrdersBonus = Math.min(ordersBonus, MAGNITUDE_BONUS_CAP - keptAtcBonus)
  } else {
    // Orders is primary on ties
    keptOrdersBonus = Math.min(ordersBonus, MAGNITUDE_BONUS_CAP)
    keptAtcBonus = Math.min(atcBonus, MAGNITUDE_BONUS_CAP - keptOrdersBonus)
  }

  return {
    ordersSignal:
      ordersBonus > 0 ? { ...ordersSignal, points: 1 + keptOrdersBonus } : ordersSignal,
    atcSignal: atcBonus > 0 ? { ...atcSignal, points: 1 + keptAtcBonus } : atcSignal,
  }
}

function scoreCreatorSaturation(
  creatorLevel: number | null,
  creatorDelta: number | null,
  ordersDelta: number | null,
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

  const formattedCreators = formatTrendNumber(creatorLevel)
  return {
    id: 'creator-saturation',
    label: 'Creator Saturation',
    detail: `Crowded (${formattedCreators} creators) — informational only`,
    points: 0,
    sentiment: 'neutral',
    countsTowardScore: true,
    warning: `Higher creator competition (${formattedCreators} creators) — demand may still justify testing, but expect more saturated hooks.`,
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

/**
 * Optional 7-day cooling overlay.
 * Fires only when 30-day orders are growing AND 7-day orders and/or ATC decline
 * by at least COOLING_DECLINE_NOISE_MAX. Steeper decline drives the tier.
 */
export function scoreRecentCooling(
  metrics: ProductScoutMetrics,
  orders30Delta: number | null,
): ProductScoutSignal | null {
  const recent = metrics.recent7d
  if (!recent) return null
  // Gate: 30-day Orders Trend must be positive growth.
  if (orders30Delta == null || !(orders30Delta > 0)) return null

  const orders7 = parseCompactNumber(recent.orders.value)
  const orders7Delta = parseDelta(recent.orders.delta)
  const atc7 = parseCompactNumber(recent.atcUsers.value)
  const atc7Delta = parseDelta(recent.atcUsers.delta)

  const declined: Array<{ label: 'orders' | 'ATC'; fraction: number }> = []

  if (orders7Delta != null && orders7Delta < 0) {
    const fraction = declineFractionFromDelta(orders7, orders7Delta)
    if (fraction != null) declined.push({ label: 'orders', fraction })
  }
  if (atc7Delta != null && atc7Delta < 0) {
    const fraction = declineFractionFromDelta(atc7, atc7Delta)
    if (fraction != null) declined.push({ label: 'ATC', fraction })
  }

  if (declined.length === 0) return null

  const steeper = Math.max(...declined.map((d) => d.fraction))
  if (steeper < COOLING_DECLINE_NOISE_MAX) return null

  const points = steeper <= COOLING_DECLINE_MILD_MAX ? -1 : -2
  const listed = declined
    .map((d) => `${d.label} down ${formatDeclinePercent(d.fraction)}`)
    .join(' and ')
  const detail = `Cooling — ${listed} in the last 7 days despite 30-day growth`

  return {
    id: 'recent-cooling',
    label: points === -1 ? 'Cooling (mild)' : 'Cooling (significant)',
    detail,
    points,
    sentiment: 'negative',
    countsTowardScore: true,
    warning: detail,
  }
}

export function scoreProductScout(metrics: ProductScoutMetrics): ProductScoutScoreResult | null {
  if (!hasProductScoutData(metrics)) return null

  const parsed = parseScoutMetrics(metrics)
  const rate = conversionRate(parsed)

  let ordersTrend = scoreOrdersTrend(parsed.orders, parsed.ordersDelta)
  let atcTrend = scoreAtcTrend(parsed.atcUsers, parsed.atcUsersDelta)
  ;({ ordersSignal: ordersTrend, atcSignal: atcTrend } = applyMagnitudeBonusCap(
    ordersTrend,
    atcTrend,
  ))

  const cooling = scoreRecentCooling(metrics, parsed.ordersDelta)

  const signals: ProductScoutSignal[] = [
    ordersTrend,
    atcTrend,
    scoreCreatorSaturation(parsed.creators, parsed.creatorsDelta, parsed.ordersDelta),
    scoreCtr(parsed.ctr, parsed.ctrDelta, parsed.creators),
    scoreConversion(parsed.orders, parsed.atcUsers),
    ...(cooling ? [cooling] : []),
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

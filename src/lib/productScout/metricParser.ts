/**
 * Parse TikTok Shop trend values like "24.1K", "1.2M", "3.5", or "3.5%".
 * Matches the reference product-scorer.jsx compact number parser.
 */
export function parseCompactNumber(input: string): number | null {
  if (input === '' || input == null) return null
  const cleaned = String(input).trim().toUpperCase().replace(/[,%]/g, '')
  const multiplier = cleaned.endsWith('K') ? 1_000 : cleaned.endsWith('M') ? 1_000_000 : 1
  const numeric = parseFloat(cleaned.replace(/[KM]/g, ''))
  if (Number.isNaN(numeric)) return null
  return numeric * multiplier
}

/**
 * Parse signed deltas like "+3.6K", "-0.5", or TikTok's ▲/▼ indicators.
 */
export function parseDelta(input: string): number | null {
  if (input === '' || input == null) return null
  const cleaned = String(input).trim()
  const isNegative = cleaned.startsWith('-') || cleaned.includes('▼')
  const value = parseCompactNumber(cleaned.replace(/[-+▲▼]/g, ''))
  if (value === null) return null
  return isNegative ? -value : value
}

/** @deprecated Use parseCompactNumber */
export function parseTrendValue(raw: string): number | null {
  return parseCompactNumber(raw)
}

/** @deprecated Use parseDelta */
export function parseTrendDelta(raw: string): number | null {
  return parseDelta(raw)
}

export function formatTrendNumber(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (abs >= 1_000_000) {
    const formatted = (abs / 1_000_000).toFixed(1).replace(/\.0$/, '')
    return `${sign}${formatted}M`
  }
  if (abs >= 1_000) {
    const formatted = (abs / 1_000).toFixed(1).replace(/\.0$/, '')
    return `${sign}${formatted}K`
  }

  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1)
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

export function formatSignedDelta(value: number, isPercent = false): string {
  if (value === 0) return isPercent ? '0%' : '0'
  const sign = value > 0 ? '+' : '-'
  const abs = Math.abs(value)
  if (isPercent) return `${sign}${abs.toFixed(1)}%`
  return `${sign}${formatTrendNumber(abs)}`
}

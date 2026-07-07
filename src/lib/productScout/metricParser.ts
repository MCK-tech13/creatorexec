/**
 * Parse TikTok Shop trend values like "24.1K", "1.2M", "3.5%".
 * Deltas may include a leading sign: "+3.6K", "-0.5%".
 */
export function parseTrendValue(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const normalized = trimmed.replace(/,/g, '').replace(/%$/, '')
  const match = normalized.match(/^([+-]?)(\d+(?:\.\d+)?)([KkMm])?$/)
  if (!match) return null

  const sign = match[1] === '-' ? -1 : 1
  const amount = parseFloat(match[2])
  if (Number.isNaN(amount)) return null

  const suffix = match[3]?.toUpperCase()
  let value = amount
  if (suffix === 'K') value *= 1_000
  if (suffix === 'M') value *= 1_000_000

  return sign * value
}

export function parseTrendDelta(raw: string, isPercent = false): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return 0

  const parsed = parseTrendValue(trimmed)
  if (parsed === null) return null

  if (isPercent) return parsed
  return parsed
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

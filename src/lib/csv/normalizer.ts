export function parseCurrency(value: string | undefined | null): number {
  if (value == null || value === '') return 0
  const cleaned = String(value).replace(/[$,\s]/g, '').replace(/[()]/g, '')
  const num = parseFloat(cleaned)
  return Number.isFinite(num) ? num : 0
}

export function parseInteger(value: string | undefined | null): number {
  if (value == null || value === '') return 0
  const cleaned = String(value).replace(/[,\s]/g, '')
  const num = parseInt(cleaned, 10)
  return Number.isFinite(num) ? num : 0
}

export function cleanString(value: string | undefined | null): string {
  if (value == null) return ''
  return String(value).trim()
}

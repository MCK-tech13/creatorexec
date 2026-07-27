import type { ColumnMapping } from '../../types'

const COLUMN_ALIASES: Record<keyof Omit<ColumnMapping, 'estStandardCommission' | 'estShopAdsCommission'>, string[]> = {
  productName: ['product name', 'product title', 'title', 'item name'],
  productId: ['product id', 'item id', 'sku'],
  itemsSold: ['items sold', 'units sold', 'quantity', 'items sold (excl. refunds)'],
  gmv: ['gmv', 'revenue', 'affiliate gmv', 'gross sales'],
}

/** Patterns that identify ESTIMATED commission columns (tiering must use these). */
const EST_STANDARD_PATTERNS = [
  /est\.?\s*standard\s*commission/,
  /estimated\s*standard\s*commission/,
]

const EST_SHOP_ADS_PATTERNS = [
  /est\.?\s*shop\s*ads\s*commission/,
  /estimated\s*shop\s*ads\s*commission/,
]

/**
 * Settled / actual columns that must NEVER be used for tiering.
 * These stay $0 (or blank/"Pending") until orders settle — days after the sale.
 */
const SETTLED_COMMISSION_PATTERNS = [
  /^standard\s*commission\b/,
  /^shop\s*ads\s*commission\b/,
  /total\s*final\s*earned/,
  /final\s*earned\s*amount/,
  /\bactual\s*(standard|shop\s*ads)?\s*commission\b/,
  /\bsettled\s*commission\b/,
]

function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, '').trim().toLowerCase()
}

function isEstimatedCommissionHeader(normalized: string): boolean {
  return (
    EST_STANDARD_PATTERNS.some((re) => re.test(normalized)) ||
    EST_SHOP_ADS_PATTERNS.some((re) => re.test(normalized))
  )
}

function isSettledCommissionHeader(normalized: string): boolean {
  if (isEstimatedCommissionHeader(normalized)) return false
  return SETTLED_COMMISSION_PATTERNS.some((re) => re.test(normalized))
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader)
  for (const alias of aliases) {
    const idx = normalized.findIndex((h) => h === alias)
    if (idx !== -1) return idx
  }
  for (const alias of aliases) {
    const idx = normalized.findIndex((h) => h.includes(alias))
    if (idx !== -1) return idx
  }
  return -1
}

/** Prefer estimated commission columns; never bind settled/actual/final columns. */
function findEstimatedCommissionIndex(
  headers: string[],
  patterns: RegExp[],
): number {
  const normalized = headers.map(normalizeHeader)
  for (let i = 0; i < normalized.length; i++) {
    const h = normalized[i]
    if (isSettledCommissionHeader(h)) continue
    if (patterns.some((re) => re.test(h))) return i
  }
  return -1
}

export function mapColumns(headers: string[]): ColumnMapping | null {
  const mapping: Partial<ColumnMapping> = {}

  for (const field of Object.keys(COLUMN_ALIASES) as (keyof typeof COLUMN_ALIASES)[]) {
    const idx = findColumnIndex(headers, COLUMN_ALIASES[field])
    if (idx === -1) {
      if (field === 'productName' || field === 'productId') return null
      mapping[field] = -1
    } else {
      mapping[field] = idx
    }
  }

  mapping.estStandardCommission = findEstimatedCommissionIndex(
    headers,
    EST_STANDARD_PATTERNS,
  )
  mapping.estShopAdsCommission = findEstimatedCommissionIndex(
    headers,
    EST_SHOP_ADS_PATTERNS,
  )

  const hasCommission =
    (mapping.estStandardCommission ?? -1) >= 0 ||
    (mapping.estShopAdsCommission ?? -1) >= 0

  if (!hasCommission) return null

  return mapping as ColumnMapping
}

export function getExpectedColumns(): string[] {
  return [
    'Product name',
    'Product ID',
    'Items sold',
    'GMV',
    'Est. standard commission',
    'Est. Shop Ads commission',
  ]
}

/** Test/debug helpers — settled columns must never map into Est. fields. */
export {
  COLUMN_ALIASES,
  normalizeHeader,
  isEstimatedCommissionHeader,
  isSettledCommissionHeader,
  EST_STANDARD_PATTERNS,
  EST_SHOP_ADS_PATTERNS,
  SETTLED_COMMISSION_PATTERNS,
}

import type { ColumnMapping } from '../../types'

const COLUMN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  productName: ['product name', 'product title', 'title', 'item name'],
  productId: ['product id', 'item id', 'sku'],
  itemsSold: ['items sold', 'units sold', 'quantity', 'items sold (excl. refunds)'],
  gmv: ['gmv', 'revenue', 'affiliate gmv', 'gross sales'],
  estStandardCommission: [
    'est. standard commission',
    'est standard commission',
  ],
  estShopAdsCommission: [
    'est. shop ads commission',
    'est shop ads commission',
    'shop ads commission',
  ],
}

function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, '').trim().toLowerCase()
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

export function mapColumns(headers: string[]): ColumnMapping | null {
  const mapping: Partial<ColumnMapping> = {}

  for (const field of Object.keys(COLUMN_ALIASES) as (keyof ColumnMapping)[]) {
    const idx = findColumnIndex(headers, COLUMN_ALIASES[field])
    if (idx === -1) {
      if (field === 'productName' || field === 'productId') return null
      mapping[field] = -1
    } else {
      mapping[field] = idx
    }
  }

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

export { COLUMN_ALIASES, normalizeHeader }

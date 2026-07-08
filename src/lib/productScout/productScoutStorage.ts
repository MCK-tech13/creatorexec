import type { ProductScoutEntry, ProductScoutEntryInsert } from '../../types/productScout'

const STORAGE_KEY = 'creatorexec-product-scout'

export function loadProductScoutEntries(): ProductScoutEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ProductScoutEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export function saveProductScoutEntries(entries: ProductScoutEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function createProductScoutEntry(partial: ProductScoutEntryInsert): ProductScoutEntry {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    productName: partial.productName.trim(),
    metrics: partial.metrics,
    createdAt: now,
    updatedAt: now,
  }
}

export function updateProductScoutEntryInList(
  entries: ProductScoutEntry[],
  id: string,
  patch: Partial<Pick<ProductScoutEntry, 'productName' | 'metrics'>>,
): ProductScoutEntry[] {
  return entries.map((entry) =>
    entry.id === id
      ? {
          ...entry,
          ...patch,
          productName: patch.productName?.trim() ?? entry.productName,
          updatedAt: new Date().toISOString(),
        }
      : entry,
  )
}

export function deleteProductScoutEntry(entries: ProductScoutEntry[], id: string): ProductScoutEntry[] {
  return entries.filter((entry) => entry.id !== id)
}

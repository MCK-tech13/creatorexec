import type { ProductScoutEntry, ProductScoutEntryInsert } from '../../types/productScout'
import { getUserDataSnapshot, updateProductScoutEntries } from '../supabase/dataStore'
import { scheduleProductScoutPersist } from '../supabase/sync'

export function loadProductScoutEntries(): ProductScoutEntry[] {
  return getUserDataSnapshot().productScoutEntries
}

export function saveProductScoutEntries(entries: ProductScoutEntry[]): void {
  updateProductScoutEntries(entries)
  scheduleProductScoutPersist()
}

/** Sync in-memory snapshot only (no background persist). */
export function syncProductScoutEntriesLocal(entries: ProductScoutEntry[]): void {
  updateProductScoutEntries(entries)
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

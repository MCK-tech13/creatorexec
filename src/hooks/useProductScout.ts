import { useCallback, useEffect, useState } from 'react'
import type { ProductScoutEntry, ProductScoutEntryInsert } from '../types/productScout'
import {
  createProductScoutEntry,
  deleteProductScoutEntry,
  loadProductScoutEntries,
  saveProductScoutEntries,
  updateProductScoutEntryInList,
} from '../lib/productScout/productScoutStorage'

export function useProductScout() {
  const [entries, setEntries] = useState<ProductScoutEntry[]>(() => loadProductScoutEntries())

  useEffect(() => {
    saveProductScoutEntries(entries)
  }, [entries])

  const addEntry = useCallback((partial: ProductScoutEntryInsert) => {
    const entry = createProductScoutEntry(partial)
    setEntries((prev) => [entry, ...prev])
    return entry
  }, [])

  const updateEntry = useCallback(
    (id: string, patch: Partial<Pick<ProductScoutEntry, 'productName' | 'metrics'>>) => {
      setEntries((prev) => updateProductScoutEntryInList(prev, id, patch))
    },
    [],
  )

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => deleteProductScoutEntry(prev, id))
  }, [])

  return {
    entries,
    addEntry,
    updateEntry,
    removeEntry,
  }
}

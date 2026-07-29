import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProductScoutEntry, ProductScoutEntryInsert } from '../types/productScout'
import {
  createProductScoutEntry,
  deleteProductScoutEntry,
  loadProductScoutEntries,
  syncProductScoutEntriesLocal,
  updateProductScoutEntryInList,
  type ProductScoutEntryPatch,
} from '../lib/productScout/productScoutStorage'
import { persistProductScoutEntriesNow } from '../lib/supabase/sync'

function persistErrorMessage(err: unknown): string {
  if (typeof err === 'string' && err.trim()) return err
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }
    if (typeof e.message === 'string' && e.message.trim()) {
      return [e.message, e.code != null && `code=${String(e.code)}`, e.details, e.hint]
        .filter((part): part is string => typeof part === 'string' && part.length > 0)
        .join(' | ')
    }
  }
  if (err instanceof Error && err.message) return err.message
  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown persist error'
  }
}

export function useProductScout() {
  const [entries, setEntries] = useState<ProductScoutEntry[]>(() => loadProductScoutEntries())
  const [persistError, setPersistError] = useState<string | null>(null)
  const entriesRef = useRef(entries)
  entriesRef.current = entries
  const didMountPersist = useRef(false)

  /**
   * Awaited upsert of the current in-memory list.
   * Returns `{ error }` instead of throwing so submit handlers can keep the
   * local entry and show the real Supabase message.
   */
  const persistNow = useCallback(async (): Promise<{ error: string | null }> => {
    try {
      // Ensure snapshot matches React state before reading it in sync.ts
      syncProductScoutEntriesLocal(entriesRef.current)
      await persistProductScoutEntriesNow()
      setPersistError(null)
      if (typeof window !== 'undefined') {
        delete (window as Window & { __CE_LAST_PERSIST_ERROR__?: string }).__CE_LAST_PERSIST_ERROR__
      }
      return { error: null }
    } catch (err) {
      const message = persistErrorMessage(err)
      console.error('[ProductScout] persist failed', err)
      setPersistError(message)
      if (typeof window !== 'undefined') {
        ;(window as Window & { __CE_LAST_PERSIST_ERROR__?: string }).__CE_LAST_PERSIST_ERROR__ =
          message
      }
      return { error: message }
    }
  }, [])

  // On first mount, re-upsert denormalized score columns (total_score / verdict /
  // scoring_logic_version). Serialized with submit via productScoutPersistLock so
  // a slow mount upsert cannot overwrite a newer submit (Production race).
  useEffect(() => {
    if (didMountPersist.current) return
    didMountPersist.current = true
    void persistNow()
  }, [persistNow])

  const addEntry = useCallback((partial: ProductScoutEntryInsert) => {
    const entry = createProductScoutEntry(partial)
    const next = [entry, ...entriesRef.current]
    entriesRef.current = next
    syncProductScoutEntriesLocal(next)
    setEntries(next)
    return entry
  }, [])

  const updateEntry = useCallback((id: string, patch: ProductScoutEntryPatch) => {
    const next = updateProductScoutEntryInList(entriesRef.current, id, patch)
    entriesRef.current = next
    syncProductScoutEntriesLocal(next)
    setEntries(next)
  }, [])

  const removeEntry = useCallback((id: string) => {
    const next = deleteProductScoutEntry(entriesRef.current, id)
    entriesRef.current = next
    syncProductScoutEntriesLocal(next)
    setEntries(next)
  }, [])

  const clearPersistError = useCallback(() => setPersistError(null), [])

  return {
    entries,
    addEntry,
    updateEntry,
    removeEntry,
    persistNow,
    persistError,
    clearPersistError,
  }
}

import { useCallback, useEffect, useState } from 'react'
import type { IncomeEntry, IncomeSource, IncomeTrackerStore } from '../types/incomeTracker'
import { EMPTY_INCOME_ENTRY, createIncomeEntryId } from '../lib/income/incomeUtils'
import { loadIncomeTracker, saveIncomeTracker } from '../lib/income/incomeStorage'

type IncomeEntryField = keyof Omit<IncomeEntry, 'id' | 'monthKey'>

export function useIncomeTracker(options?: { initialStore?: IncomeTrackerStore }) {
  const [store, setStore] = useState<IncomeTrackerStore>(
    () => options?.initialStore ?? loadIncomeTracker(),
  )

  useEffect(() => {
    saveIncomeTracker(store)
  }, [store])

  const addEntry = useCallback((monthKey: string, partial?: Partial<Omit<IncomeEntry, 'id' | 'monthKey'>>) => {
    const entry: IncomeEntry = {
      id: createIncomeEntryId(),
      monthKey,
      ...EMPTY_INCOME_ENTRY,
      ...partial,
    }
    setStore((prev) => [...prev, entry])
    return entry.id
  }, [])

  const updateEntryField = useCallback(
    <K extends IncomeEntryField>(entryId: string, field: K, value: IncomeEntry[K]) => {
      setStore((prev) =>
        prev.map((entry) => (entry.id === entryId ? { ...entry, [field]: value } : entry)),
      )
    },
    [],
  )

  const deleteEntry = useCallback((entryId: string) => {
    setStore((prev) => prev.filter((entry) => entry.id !== entryId))
  }, [])

  const upsertEntry = useCallback((entry: IncomeEntry) => {
    setStore((prev) => {
      const index = prev.findIndex((item) => item.id === entry.id)
      if (index === -1) return [...prev, entry]
      const next = [...prev]
      next[index] = entry
      return next
    })
  }, [])

  const setEntrySource = useCallback((entryId: string, source: IncomeSource) => {
    updateEntryField(entryId, 'source', source)
  }, [updateEntryField])

  return {
    store,
    addEntry,
    updateEntryField,
    deleteEntry,
    upsertEntry,
    setEntrySource,
  }
}

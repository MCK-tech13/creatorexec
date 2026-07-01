import { useCallback, useEffect, useState } from 'react'
import type { IncomeMonthEntry, IncomeTrackerStore } from '../types/incomeTracker'
import { EMPTY_INCOME_ENTRY } from '../lib/income/incomeUtils'
import { loadIncomeTracker, saveIncomeTracker } from '../lib/income/incomeStorage'

export function useIncomeTracker() {
  const [store, setStore] = useState<IncomeTrackerStore>(() => loadIncomeTracker())

  useEffect(() => {
    saveIncomeTracker(store)
  }, [store])

  const upsertMonth = useCallback((key: string, entry: IncomeMonthEntry) => {
    setStore((prev) => ({ ...prev, [key]: entry }))
  }, [])

  const ensureMonth = useCallback((key: string): IncomeMonthEntry => {
    return store[key] ?? { ...EMPTY_INCOME_ENTRY }
  }, [store])

  const createMonth = useCallback((key: string) => {
    setStore((prev) => {
      if (prev[key]) return prev
      return { ...prev, [key]: { ...EMPTY_INCOME_ENTRY } }
    })
  }, [])

  const updateMonthField = useCallback(
    (key: string, field: keyof IncomeMonthEntry, value: number) => {
      setStore((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] ?? EMPTY_INCOME_ENTRY),
          [field]: value,
        },
      }))
    },
    [],
  )

  return {
    store,
    upsertMonth,
    ensureMonth,
    createMonth,
    updateMonthField,
  }
}

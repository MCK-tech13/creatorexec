import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'creatorexec-filming-progress'

function loadProgress(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    return Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [k, Math.max(0, Number(v) || 0)]),
    )
  } catch {
    return {}
  }
}

export function useFilmingProgress() {
  const [progress, setProgress] = useState<Record<string, number>>(loadProgress)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  }, [progress])

  const getCount = useCallback(
    (storageKey: string) => progress[storageKey] ?? 0,
    [progress],
  )

  const increment = useCallback((storageKey: string, max: number) => {
    setProgress((prev) => ({
      ...prev,
      [storageKey]: Math.min(max, (prev[storageKey] ?? 0) + 1),
    }))
  }, [])

  const decrement = useCallback((storageKey: string) => {
    setProgress((prev) => ({
      ...prev,
      [storageKey]: Math.max(0, (prev[storageKey] ?? 0) - 1),
    }))
  }, [])

  return { getCount, increment, decrement }
}

export function clearFilmingProgress() {
  localStorage.removeItem(STORAGE_KEY)
}

/** @deprecated use clearFilmingProgress */
export function clearFilmingChecklist() {
  clearFilmingProgress()
}

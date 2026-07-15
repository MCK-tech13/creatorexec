import { useCallback, useState } from 'react'
import type { FilmingProgressStore } from '../types/currentSprint'
import { clearLegacyFilmingProgress } from '../lib/sprint/filmingProgressMigration'

export function useFilmingProgress(initialProgress: FilmingProgressStore = {}) {
  const [progress, setProgress] = useState<FilmingProgressStore>(initialProgress)

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

  const reset = useCallback(() => {
    setProgress({})
    clearLegacyFilmingProgress()
  }, [])

  return { progress, getCount, increment, decrement, reset, setProgress }
}

export function clearFilmingProgress() {
  clearLegacyFilmingProgress()
}

/** @deprecated use clearFilmingProgress */
export function clearScheduleProgress() {
  clearFilmingProgress()
}

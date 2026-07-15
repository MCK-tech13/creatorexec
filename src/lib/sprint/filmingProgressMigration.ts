import type { FilmingProgressStore } from '../../types/currentSprint'
import { LOCAL_STORAGE_KEYS, filmingProgressMigrationFlagKey } from '../supabase/localStorageKeys'

const LEGACY_KEY = LOCAL_STORAGE_KEYS.filmingProgress

export function readLegacyFilmingProgress(): FilmingProgressStore {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, Math.max(0, Number(value) || 0)]),
    )
  } catch {
    return {}
  }
}

export function isFilmingProgressMigrated(userId: string): boolean {
  try {
    return localStorage.getItem(filmingProgressMigrationFlagKey(userId)) === 'true'
  } catch {
    return false
  }
}

export function markFilmingProgressMigrated(userId: string): void {
  try {
    localStorage.setItem(filmingProgressMigrationFlagKey(userId), 'true')
  } catch {
    // ignore quota / private mode
  }
}

export function clearLegacyFilmingProgress(): void {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // ignore
  }
}

/** Prefer the higher count per key when merging cloud + legacy browser data. */
export function mergeFilmingProgress(
  cloud: FilmingProgressStore,
  legacy: FilmingProgressStore,
): FilmingProgressStore {
  const merged: FilmingProgressStore = { ...cloud }
  for (const [key, legacyCount] of Object.entries(legacy)) {
    const cloudCount = merged[key] ?? 0
    merged[key] = Math.max(cloudCount, legacyCount)
  }
  return merged
}

/**
 * On first save in a browser that still has creatorexec-filming-progress,
 * merge those counts into the payload, clear localStorage, and mark migrated.
 * No-ops if already migrated or legacy store is empty.
 */
export function mergeAndConsumeLegacyFilmingProgress(
  userId: string,
  cloud: FilmingProgressStore,
): FilmingProgressStore {
  if (isFilmingProgressMigrated(userId)) return cloud

  const legacy = readLegacyFilmingProgress()
  if (Object.keys(legacy).length === 0) {
    markFilmingProgressMigrated(userId)
    return cloud
  }

  const merged = mergeFilmingProgress(cloud, legacy)
  clearLegacyFilmingProgress()
  markFilmingProgressMigrated(userId)
  return merged
}

/**
 * For restore/hydrate UI: merge legacy into cloud without clearing yet
 * (clear happens on first successful persist).
 */
export function previewLegacyFilmingMerge(
  userId: string,
  cloud: FilmingProgressStore,
): FilmingProgressStore {
  if (isFilmingProgressMigrated(userId)) return cloud
  const legacy = readLegacyFilmingProgress()
  if (Object.keys(legacy).length === 0) return cloud
  return mergeFilmingProgress(cloud, legacy)
}

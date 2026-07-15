/**
 * Unit checks for current-sprint filming progress merge helpers.
 * Usage: npx tsx scripts/verify-current-sprint-persist.ts
 */
import assert from 'node:assert/strict'
import {
  mergeAndConsumeLegacyFilmingProgress,
  mergeFilmingProgress,
  isFilmingProgressMigrated,
  readLegacyFilmingProgress,
} from '../src/lib/sprint/filmingProgressMigration.ts'
import { hasPersistedSprintContent } from '../src/types/currentSprint.ts'
import { LOCAL_STORAGE_KEYS, filmingProgressMigrationFlagKey } from '../src/lib/supabase/localStorageKeys.ts'

const store = new Map<string, string>()
globalThis.localStorage = {
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  setItem: (key: string, value: string) => {
    store.set(key, String(value))
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
  clear: () => store.clear(),
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() {
    return store.size
  },
}

store.set(
  LOCAL_STORAGE_KEYS.filmingProgress,
  JSON.stringify({ 'd1::A': 2, 'd2::B': 1 }),
)

const merged = mergeFilmingProgress({ 'd1::A': 1, 'd3::C': 4 }, readLegacyFilmingProgress())
assert.deepEqual(merged, { 'd1::A': 2, 'd3::C': 4, 'd2::B': 1 })

const userId = 'user-test-1'
assert.equal(isFilmingProgressMigrated(userId), false)

const firstSave = mergeAndConsumeLegacyFilmingProgress(userId, { 'd1::A': 0 })
assert.deepEqual(firstSave, { 'd1::A': 2, 'd2::B': 1 })
assert.equal(isFilmingProgressMigrated(userId), true)
assert.equal(localStorage.getItem(LOCAL_STORAGE_KEYS.filmingProgress), null)
assert.equal(localStorage.getItem(filmingProgressMigrationFlagKey(userId)), 'true')

const secondSave = mergeAndConsumeLegacyFilmingProgress(userId, { 'd1::A': 9 })
assert.deepEqual(secondSave, { 'd1::A': 9 })

assert.equal(
  hasPersistedSprintContent({
    stage: 'upload',
    scheduleMode: 'full',
    fileName: null,
    sprintConfig: { videosPerDay: 5, sprintDays: 7 },
    products: [],
    deadlineProducts: [],
    excludedProductKeys: [],
    sampleProducts: [],
    schedule: [],
    filmingProgress: { 'd1::X': 1 },
  }),
  false,
)

assert.equal(
  hasPersistedSprintContent({
    stage: 'config',
    scheduleMode: 'full',
    fileName: 'a.csv',
    sprintConfig: { videosPerDay: 5, sprintDays: 7 },
    products: [{ id: '1' } as never],
    deadlineProducts: [],
    excludedProductKeys: [],
    sampleProducts: [],
    schedule: [],
    filmingProgress: {},
  }),
  true,
)

console.log('verify-current-sprint-persist: all checks passed')

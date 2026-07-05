import type { SprintSnapshot } from '../../types/sprintReview'

const START_KEY = 'creatorexec-sprint-start'
const PREVIOUS_KEY = 'creatorexec-sprint-previous'

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore when storage is unavailable.
  }
}

export function loadSprintStartSnapshot(): SprintSnapshot | null {
  return readJson<SprintSnapshot>(START_KEY)
}

export function saveSprintStartSnapshot(snapshot: SprintSnapshot): void {
  writeJson(START_KEY, snapshot)
}

export function loadPreviousSprintSnapshot(): SprintSnapshot | null {
  return readJson<SprintSnapshot>(PREVIOUS_KEY)
}

export function savePreviousSprintSnapshot(snapshot: SprintSnapshot): void {
  writeJson(PREVIOUS_KEY, snapshot)
}

export function clearSprintStartSnapshot(): void {
  try {
    localStorage.removeItem(START_KEY)
  } catch {
    // Ignore when storage is unavailable.
  }
}

export function clearSprintSnapshots(): void {
  clearSprintStartSnapshot()
  try {
    localStorage.removeItem(PREVIOUS_KEY)
  } catch {
    // Ignore when storage is unavailable.
  }
}

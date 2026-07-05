const STORAGE_KEY = 'creatorexec-angle-rotation'

export interface AngleRotationEntry {
  nextIndex: number
}

export type AngleRotationStore = Record<string, AngleRotationEntry>

export function loadAngleRotation(): AngleRotationStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as AngleRotationStore
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {}
    }
    return Object.fromEntries(
      Object.entries(parsed).map(([key, entry]) => [
        key,
        {
          nextIndex: Math.max(0, Number(entry?.nextIndex) || 0),
        },
      ]),
    )
  } catch {
    return {}
  }
}

export function saveAngleRotation(store: AngleRotationStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Ignore when storage is unavailable (e.g. SSR or test runners without localStorage).
  }
}

export function clearAngleRotation(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore when storage is unavailable.
  }
}

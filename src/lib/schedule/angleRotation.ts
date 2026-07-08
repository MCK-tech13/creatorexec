import { angleAtPoolIndex } from './anglePool'
import {
  loadAngleRotation,
  saveAngleRotation,
  type AngleRotationStore,
} from './angleRotationStorage'
import { trialStorageKey } from './trialProgressStorage'

export { CONTENT_ANGLE_POOL } from './anglePool'
export {
  clearAngleRotation,
  loadAngleRotation,
  saveAngleRotation,
  type AngleRotationEntry,
  type AngleRotationStore,
} from './angleRotationStorage'

export function getAngleRotationIndex(
  product: { id: string; productId: string },
  store: AngleRotationStore = loadAngleRotation(),
): number {
  return store[trialStorageKey(product)]?.nextIndex ?? 0
}

/** Advances the per-product rotation and returns the angle for this occurrence. */
export class AngleRotationSession {
  private store: AngleRotationStore
  private dirty = false

  constructor(initialStore?: AngleRotationStore) {
    this.store = initialStore ? { ...initialStore } : loadAngleRotation()
  }

  consumeAngle(product: { id: string; productId: string }): string {
    const key = trialStorageKey(product)
    const index = this.store[key]?.nextIndex ?? 0
    const angle = angleAtPoolIndex(index)
    this.store[key] = { nextIndex: index + 1 }
    this.dirty = true
    return angle
  }

  getStore(): AngleRotationStore {
    return this.store
  }

  persist(): void {
    if (this.dirty) {
      saveAngleRotation(this.store)
      this.dirty = false
    }
  }
}

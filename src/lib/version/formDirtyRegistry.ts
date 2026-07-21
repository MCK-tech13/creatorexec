/**
 * Tracks whether any in-progress form has unsaved input.
 * Used by the client version guard to defer auto-reload until forms are clean.
 */

const dirtyForms = new Set<string>()
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function markClientFormDirty(formId: string): void {
  if (dirtyForms.has(formId)) return
  dirtyForms.add(formId)
  notify()
}

export function clearClientFormDirty(formId: string): void {
  if (!dirtyForms.has(formId)) return
  dirtyForms.delete(formId)
  notify()
}

export function hasDirtyClientForms(): boolean {
  return dirtyForms.size > 0
}

export function subscribeClientFormDirty(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

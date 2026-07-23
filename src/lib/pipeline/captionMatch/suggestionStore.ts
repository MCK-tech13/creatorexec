import { getActiveUserId } from '../../supabase/dataStore'

const PREFIX = 'creatorexec-caption-match'

function key(kind: 'dismissed' | 'confirmed'): string {
  return `${PREFIX}-${kind}-${getActiveUserId()}`
}

function readSet(kind: 'dismissed' | 'confirmed'): Set<string> {
  try {
    const raw = localStorage.getItem(key(kind))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function writeSet(kind: 'dismissed' | 'confirmed', values: Set<string>): void {
  try {
    localStorage.setItem(key(kind), JSON.stringify([...values]))
  } catch {
    // ignore quota / private mode
  }
}

export function loadDismissedSuggestionIds(): Set<string> {
  return readSet('dismissed')
}

export function loadConfirmedCaptionIds(): Set<string> {
  return readSet('confirmed')
}

export function dismissSuggestion(suggestionId: string): void {
  const next = loadDismissedSuggestionIds()
  next.add(suggestionId)
  writeSet('dismissed', next)
}

export function confirmCaptionSuggestion(captionPostId: string, suggestionId: string): void {
  const confirmed = loadConfirmedCaptionIds()
  confirmed.add(captionPostId)
  writeSet('confirmed', confirmed)
  const dismissed = loadDismissedSuggestionIds()
  dismissed.add(suggestionId)
  writeSet('dismissed', dismissed)
}

/** Clears dismiss/confirm history so the Preview demo can re-trigger the modal. */
export function resetCaptionMatchSuggestionHistory(): void {
  writeSet('dismissed', new Set())
  writeSet('confirmed', new Set())
}

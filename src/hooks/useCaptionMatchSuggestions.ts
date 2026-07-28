import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BrandDeal } from '../types/pipeline'
import { buildCaptionMatchSuggestions } from '../lib/pipeline/captionMatch/matcher'
import { fetchRecentCaptions } from '../lib/pipeline/captionMatch/mockCaptions'
import {
  confirmCaptionSuggestion,
  dismissSuggestion,
  loadConfirmedCaptionIds,
  loadDismissedSuggestionIds,
  resetCaptionMatchSuggestionHistory,
} from '../lib/pipeline/captionMatch/suggestionStore'
import type { CaptionMatchSuggestion, CaptionPost } from '../lib/pipeline/captionMatch/types'

function readPendingSuggestions(
  captions: CaptionPost[],
  deals: BrandDeal[],
): CaptionMatchSuggestion[] {
  return buildCaptionMatchSuggestions(captions, deals, {
    dismissedIds: loadDismissedSuggestionIds(),
    confirmedCaptionIds: loadConfirmedCaptionIds(),
  })
}

/**
 * Loads mock (later: real) captions, matches against active retainers, and
 * drains interruptive suggestions back-to-back in one sitting.
 *
 * After Confirm / Not this one, the next pending suggestion is presented
 * immediately — no navigation required. When the queue is empty, the modal
 * stays closed until new pending items appear (e.g. fresh app load or demo replay).
 */
export function useCaptionMatchSuggestions(deals: BrandDeal[]) {
  const [captions, setCaptions] = useState<CaptionPost[]>([])
  const [revision, setRevision] = useState(0)
  const [ready, setReady] = useState(false)
  /** Explicitly presented interrupt — advanced synchronously on act. */
  const [presented, setPresented] = useState<CaptionMatchSuggestion | null>(null)

  const refresh = useCallback(() => {
    setRevision((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchRecentCaptions().then((posts) => {
      if (cancelled) return
      setCaptions(posts)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const pending = useMemo(() => {
    void revision
    return readPendingSuggestions(captions, deals)
  }, [captions, deals, revision])

  // Keep presented aligned with pending: advance when current was resolved,
  // or open the queue when something is pending and nothing is on screen.
  useEffect(() => {
    if (!ready) return

    setPresented((current) => {
      if (current) {
        const stillThere = pending.find((s) => s.id === current.id)
        if (stillThere) return stillThere
        // Acted on current — continue the same sitting with the next item.
        return pending[0] ?? null
      }
      return pending[0] ?? null
    })
  }, [ready, pending])

  const declineSuggestion = useCallback(
    (suggestion: CaptionMatchSuggestion) => {
      dismissSuggestion(suggestion.id)
      // Advance immediately in this tick so the next modal body shows without
      // waiting for a remount or a later navigation.
      const nextQueue = readPendingSuggestions(captions, deals)
      setPresented(nextQueue[0] ?? null)
      refresh()
    },
    [captions, deals, refresh],
  )

  const markSuggestionConfirmed = useCallback(
    (suggestion: CaptionMatchSuggestion) => {
      confirmCaptionSuggestion(suggestion.captionPostId, suggestion.id)
      const nextQueue = readPendingSuggestions(captions, deals)
      setPresented(nextQueue[0] ?? null)
      refresh()
    },
    [captions, deals, refresh],
  )

  const resetDemoHistory = useCallback(() => {
    resetCaptionMatchSuggestionHistory()
    setPresented(null)
    refresh()
  }, [refresh])

  const pendingCount = pending.length
  const remainingAfterCurrent = presented
    ? Math.max(0, pending.filter((s) => s.id !== presented.id).length)
    : 0

  return {
    ready,
    suggestions: pending,
    pendingCount,
    remainingAfterCurrent,
    activeSuggestion: presented,
    declineSuggestion,
    markSuggestionConfirmed,
    resetDemoHistory,
    refresh,
  }
}

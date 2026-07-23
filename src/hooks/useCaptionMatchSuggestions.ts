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

/**
 * Loads mock (later: real) captions, matches against active retainers, and
 * exposes the next interruptive suggestion for app-open confirm.
 */
export function useCaptionMatchSuggestions(deals: BrandDeal[]) {
  const [captions, setCaptions] = useState<CaptionPost[]>([])
  const [revision, setRevision] = useState(0)
  const [ready, setReady] = useState(false)

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

  const suggestions = useMemo(() => {
    void revision
    return buildCaptionMatchSuggestions(captions, deals, {
      dismissedIds: loadDismissedSuggestionIds(),
      confirmedCaptionIds: loadConfirmedCaptionIds(),
    })
  }, [captions, deals, revision])

  const activeSuggestion = suggestions[0] ?? null

  const declineSuggestion = useCallback(
    (suggestion: CaptionMatchSuggestion) => {
      dismissSuggestion(suggestion.id)
      refresh()
    },
    [refresh],
  )

  const markSuggestionConfirmed = useCallback(
    (suggestion: CaptionMatchSuggestion) => {
      confirmCaptionSuggestion(suggestion.captionPostId, suggestion.id)
      refresh()
    },
    [refresh],
  )

  const resetDemoHistory = useCallback(() => {
    resetCaptionMatchSuggestionHistory()
    refresh()
  }, [refresh])

  return {
    ready,
    suggestions,
    activeSuggestion,
    declineSuggestion,
    markSuggestionConfirmed,
    resetDemoHistory,
    refresh,
  }
}

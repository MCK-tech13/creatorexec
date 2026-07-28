import { createPortal } from 'react-dom'
import type { CaptionMatchSuggestion } from '../../lib/pipeline/captionMatch/types'

interface CaptionMatchConfirmModalProps {
  suggestion: CaptionMatchSuggestion
  /** How many other pending suggestions will follow in this sitting. */
  remainingAfterCurrent?: number
  onConfirm: () => void
  onDecline: () => void
}

/**
 * Interruptive confirm — not a passive banner. Surfaces when a mock (later real)
 * caption likely matches an active retainer deal.
 * Portaled to document.body so PageContainer max-width never clips the overlay.
 *
 * Queue behavior: after Confirm / Not this one, the parent advances to the next
 * pending suggestion immediately (same sitting). key={suggestion.id} remounts
 * the panel so each item reads as a fresh step.
 */
export function CaptionMatchConfirmModal({
  suggestion,
  remainingAfterCurrent = 0,
  onConfirm,
  onDecline,
}: CaptionMatchConfirmModalProps) {
  const brandLabel = suggestion.brandName
  const productHint = suggestion.product?.trim()
    ? ` (${suggestion.product.trim()})`
    : ''

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/50 px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="caption-match-title"
    >
      <div
        key={suggestion.id}
        className="w-full max-w-md border border-border-warm bg-white p-8 fade-in shadow-lg"
      >
        <p className="label-caps text-terracotta">Posted for a deal?</p>
        <h2
          id="caption-match-title"
          className="mt-3 font-display text-2xl font-bold text-ink"
        >
          Looks like you posted for {brandLabel}
        </h2>
        <p className="mt-4 font-body text-base text-stone">
          Mark this video as filmed for this deal{productHint}?
        </p>
        <blockquote className="mt-5 border-l-2 border-emerald/40 pl-4 font-body text-sm italic text-ink">
          “{suggestion.caption}”
        </blockquote>
        <p className="mt-2 font-body text-xs text-stone">Posted {suggestion.postedAt}</p>
        {remainingAfterCurrent > 0 && (
          <p className="mt-3 font-body text-xs text-stone">
            {remainingAfterCurrent === 1
              ? '1 more suggestion after this — you’ll see it next.'
              : `${remainingAfterCurrent} more suggestions after this — you’ll work through them next.`}
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onConfirm} className="btn-primary flex-1 py-3">
            Confirm — mark filmed
          </button>
          <button type="button" onClick={onDecline} className="btn-outline flex-1 py-3">
            Not this one
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

interface MomentumModePromptModalProps {
  onConfirm: () => void
  onDecline: () => void
}

export function MomentumModePromptModal({
  onConfirm,
  onDecline,
}: MomentumModePromptModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="momentum-prompt-title"
    >
      <div className="w-full max-w-md border border-border-warm bg-white p-8 fade-in">
        <h2
          id="momentum-prompt-title"
          className="font-display text-2xl font-bold text-ink"
        >
          Still building your sales data?
        </h2>
        <p className="mt-4 font-body text-base text-stone">
          It looks like you&apos;re still building your sales data. Would you like to use
          Momentum Mode for a balanced schedule?
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onConfirm} className="btn-primary flex-1 py-3">
            Yes, use Momentum Mode
          </button>
          <button type="button" onClick={onDecline} className="btn-outline flex-1 py-3">
            No, use full rankings
          </button>
        </div>
      </div>
    </div>
  )
}

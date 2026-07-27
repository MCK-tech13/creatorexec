interface ResetCurrentSprintModalProps {
  onConfirm: () => void
  onCancel: () => void
}

/** Confirm before abandoning the live sprint workspace (catalog kept). */
export function ResetCurrentSprintModal({ onConfirm, onCancel }: ResetCurrentSprintModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-current-sprint-title"
    >
      <div className="w-full max-w-md border border-border-warm bg-white p-8 fade-in">
        <h2 id="reset-current-sprint-title" className="font-display text-2xl font-bold text-ink">
          Reset current sprint?
        </h2>
        <p className="mt-4 font-body text-base text-stone">
          This clears your active schedule and sprint products so you can start a new sprint.
        </p>
        <p className="mt-3 font-body text-sm text-stone">
          Your product catalog, trial progress, retainers, income tracker, and product scout
          entries are kept. This does not save a sprint review.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onConfirm} className="btn-primary flex-1 py-3">
            Reset current sprint
          </button>
          <button type="button" onClick={onCancel} className="btn-outline flex-1 py-3">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

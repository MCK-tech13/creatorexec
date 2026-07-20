interface ResetDataModalProps {
  onConfirm: () => void
  onCancel: () => void
}

export function ResetDataModal({ onConfirm, onCancel }: ResetDataModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-data-title"
    >
      <div className="w-full max-w-md border border-border-warm bg-white p-8 fade-in">
        <h2 id="reset-data-title" className="font-display text-2xl font-bold text-ink">
          Reset your data?
        </h2>
        <p className="mt-4 font-body text-base text-stone">
          This clears your product catalog, trial progress, and current sprint, then takes you
          back to the setup quiz so you can start fresh.
        </p>
        <p className="mt-3 font-body text-sm text-stone">
          Retainers, income tracker, and product scout entries are kept.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onConfirm} className="btn-primary flex-1 py-3">
            Reset Data
          </button>
          <button type="button" onClick={onCancel} className="btn-outline flex-1 py-3">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

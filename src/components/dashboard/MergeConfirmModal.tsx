interface MergeConfirmModalProps {
  title: string
  bodyLines: string[]
  onConfirm: () => void
  onCancel: () => void
}

/** Strong confirm before permanently linking catalog rows. */
export function MergeConfirmModal({
  title,
  bodyLines,
  onConfirm,
  onCancel,
}: MergeConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-products-title"
    >
      <div className="w-full max-w-lg border border-border-warm bg-white p-8 fade-in">
        <h2 id="merge-products-title" className="font-display text-2xl font-bold text-ink">
          {title}
        </h2>
        <div className="mt-4 space-y-3">
          {bodyLines.map((line) => (
            <p key={line} className="font-body text-sm leading-relaxed text-stone">
              {line}
            </p>
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onConfirm} className="btn-primary flex-1 py-3">
            Merge products
          </button>
          <button type="button" onClick={onCancel} className="btn-outline flex-1 py-3">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

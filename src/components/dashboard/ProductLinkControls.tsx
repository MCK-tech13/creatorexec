interface ProductLinkControlsProps {
  linkMode: boolean
  selectedCount: number
  canUndo: boolean
  undoLabel: string | null
  onToggleLinkMode: () => void
  onOpenMergeConfirm: () => void
  onUndoLatest: () => void
}

/** Toolbar for manual “same product” linking on the Analyze product list. */
export function ProductLinkControls({
  linkMode,
  selectedCount,
  canUndo,
  undoLabel,
  onToggleLinkMode,
  onOpenMergeConfirm,
  onUndoLatest,
}: ProductLinkControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-border-warm bg-cream/40 px-4 py-3">
      <div className="min-w-0">
        <p className="font-body text-sm font-medium text-ink">
          {linkMode ? 'Select listings that are the same product' : 'Same product listed twice?'}
        </p>
        <p className="mt-0.5 font-body text-xs text-stone">
          {linkMode
            ? 'First selected keeps the catalog record. Sales add; videos filmed uses the higher count.'
            : 'Manually link them so future reports update one row.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canUndo && undoLabel && (
          <button
            type="button"
            onClick={onUndoLatest}
            className="btn-outline px-4 py-2 text-sm"
            title={`Undo merge of ${undoLabel}`}
          >
            Undo last merge
          </button>
        )}
        {linkMode && (
          <button
            type="button"
            onClick={onOpenMergeConfirm}
            disabled={selectedCount < 2}
            className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Merge selected{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleLinkMode}
          className={linkMode ? 'btn-outline px-4 py-2 text-sm' : 'btn-secondary px-4 py-2 text-sm'}
        >
          {linkMode ? 'Cancel linking' : 'Link same products'}
        </button>
      </div>
    </div>
  )
}

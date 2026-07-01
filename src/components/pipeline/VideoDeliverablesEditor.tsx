import { Plus, X } from 'lucide-react'
import type { BrandDeal } from '../../types/pipeline'
import {
  getVideoDeliverableRows,
  patchAddVideoRow,
  patchRemoveVideoRow,
  patchVideoRowField,
} from '../../lib/pipeline/videoDeliverableUtils'
import { CopyableField } from './CopyableField'

interface VideoDeliverablesEditorProps {
  deal: BrandDeal
  onUpdate: (patch: Partial<BrandDeal>) => void
}

export function VideoDeliverablesEditor({ deal, onUpdate }: VideoDeliverablesEditorProps) {
  const rows = getVideoDeliverableRows(deal)
  const canRemoveRow = rows.length > 1

  return (
    <div>
      <span className="label-caps mb-3 block">Video Links &amp; Ad Codes</span>
      <div className="space-y-6">
        {rows.map((row) => (
          <div key={row.id} className="border border-border-warm p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="font-body text-sm font-medium text-ink">{row.label}</p>
              {canRemoveRow && (
                <button
                  type="button"
                  onClick={() => {
                    const patch = patchRemoveVideoRow(deal, row.id)
                    if (patch) onUpdate(patch)
                  }}
                  className="flex h-7 w-7 items-center justify-center border border-border-warm text-stone transition hover:border-tier-deadline hover:text-tier-deadline"
                  aria-label={`Remove ${row.label}`}
                  title={`Remove ${row.label}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-4">
              <CopyableField
                label="Video Link"
                value={row.videoLink}
                placeholder="Paste TikTok or drive link"
                onChange={(value) => onUpdate(patchVideoRowField(deal, row.id, 'videoLink', value))}
              />
              <CopyableField
                label="Ad Code"
                value={row.adCode}
                placeholder="Spark / ad authorization code"
                onChange={(value) => onUpdate(patchVideoRowField(deal, row.id, 'adCode', value))}
              />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onUpdate(patchAddVideoRow(deal))}
        className="btn-outline mt-4 inline-flex items-center gap-2 px-4 py-2.5 font-body text-sm"
      >
        <Plus className="h-4 w-4" />
        Add Video Link &amp; Ad Code
      </button>
    </div>
  )
}

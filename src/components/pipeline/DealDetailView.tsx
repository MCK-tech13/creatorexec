import { Trash2 } from 'lucide-react'
import type { BrandDeal, DealStage, DealType } from '../../types/pipeline'
import { DEAL_STAGES } from '../../types/pipeline'
import { calcRetainerProgress, countVideosCompleted } from '../../lib/pipeline/retainerUtils'
import { CopyableField } from './CopyableField'
import { RetainerFields } from './RetainerFields'

interface DealDetailViewProps {
  deal: BrandDeal
  dailyPostingVolume: number
  onUpdate: (patch: Partial<BrandDeal>) => void
  onDelete: () => void
  onClose: () => void
  onToggleChecklist: (itemId: string) => void
}

const DEAL_TYPES: { value: DealType; label: string }[] = [
  { value: 'video', label: 'Video' },
  { value: 'live', label: 'Live' },
  { value: 'bundle', label: 'Bundle' },
]

export function DealDetailView({
  deal,
  dailyPostingVolume,
  onUpdate,
  onDelete,
  onClose,
  onToggleChecklist,
}: DealDetailViewProps) {
  const retainerProgress = calcRetainerProgress(deal, dailyPostingVolume)
  const completed = countVideosCompleted(deal)
  const checklistTarget = deal.isRetainer
    ? (deal.retainerTotalVideos ?? 0)
    : (deal.videosRequired ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40">
      <div className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-border-warm bg-white">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-warm bg-white px-6 py-5">
          <h2 className="font-display text-2xl font-bold text-ink">{deal.brandName}</h2>
          <button
            type="button"
            onClick={onClose}
            className="font-body text-sm text-stone hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <label className="label-caps mb-2 block">Brand Name</label>
            <input
              type="text"
              value={deal.brandName}
              onChange={(e) => onUpdate({ brandName: e.target.value })}
              className="input-field w-full px-4 py-3"
            />
          </div>

          <div>
            <label className="label-caps mb-2 block">Product</label>
            <input
              type="text"
              value={deal.product}
              onChange={(e) => onUpdate({ product: e.target.value })}
              className="input-field w-full px-4 py-3"
            />
          </div>

          <div>
            <label className="label-caps mb-2 block">Stage</label>
            <select
              value={deal.stage}
              onChange={(e) => onUpdate({ stage: e.target.value as DealStage })}
              className="input-field w-full px-4 py-3 font-body text-sm"
            >
              {DEAL_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <RetainerFields
            isRetainer={Boolean(deal.isRetainer)}
            onIsRetainerChange={(value) => onUpdate({ isRetainer: value })}
            totalVideos={deal.retainerTotalVideos}
            onTotalVideosChange={(value) => onUpdate({ retainerTotalVideos: value })}
            deadlineDate={deal.retainerDeadlineDate}
            onDeadlineChange={(value) => onUpdate({ retainerDeadlineDate: value })}
            videosCompleted={completed}
            retainerProgress={retainerProgress}
          />

          <div>
            <span className="label-caps mb-2 block">Deal Type</span>
            <div className="grid grid-cols-3 gap-px bg-border-warm">
              {DEAL_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdate({ dealType: opt.value })}
                  className={`py-3 font-body text-sm font-medium transition ${
                    deal.dealType === opt.value
                      ? 'bg-emerald text-white'
                      : 'bg-white text-stone hover:text-ink'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-caps mb-2 block">Compensation ($)</label>
              <input
                type="number"
                min={0}
                value={deal.compensation ?? ''}
                onChange={(e) =>
                  onUpdate({
                    compensation: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                className="input-field w-full px-4 py-3"
              />
            </div>
            <div>
              <label className="label-caps mb-2 block">Commission %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={deal.commissionPercent ?? ''}
                onChange={(e) =>
                  onUpdate({
                    commissionPercent: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
                className="input-field w-full px-4 py-3"
              />
            </div>
          </div>

          {!deal.isRetainer && (
            <>
              <div>
                <label className="label-caps mb-2 block">Videos Required</label>
                <input
                  type="number"
                  min={0}
                  value={deal.videosRequired ?? ''}
                  onChange={(e) =>
                    onUpdate({
                      videosRequired: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    })
                  }
                  className="input-field w-full px-4 py-3"
                />
              </div>
              <div>
                <label className="label-caps mb-2 block">Deadline Date</label>
                <input
                  type="date"
                  value={deal.deadlineDate ?? ''}
                  onChange={(e) => onUpdate({ deadlineDate: e.target.value || undefined })}
                  className="input-field w-full px-4 py-3"
                />
              </div>
            </>
          )}

          <label className="flex items-center gap-3 font-body text-sm text-ink">
            <input
              type="checkbox"
              checked={deal.contractSigned}
              onChange={(e) => onUpdate({ contractSigned: e.target.checked })}
              className="accent-checkbox h-4 w-4"
            />
            Contract Signed
          </label>

          <CopyableField
            label="Video Link"
            value={deal.videoLink ?? ''}
            placeholder="Paste TikTok or drive link"
            onChange={(v) => onUpdate({ videoLink: v || undefined })}
          />

          <CopyableField
            label="Ad Code"
            value={deal.adCode ?? ''}
            placeholder="Spark / ad authorization code"
            onChange={(v) => onUpdate({ adCode: v || undefined })}
          />

          <div>
            <label className="label-caps mb-2 block">Notes</label>
            <textarea
              value={deal.notes ?? ''}
              onChange={(e) => onUpdate({ notes: e.target.value || undefined })}
              rows={4}
              className="input-field w-full resize-none px-4 py-3 font-body text-sm"
            />
          </div>

          {checklistTarget > 0 && (
            <div>
              <span className="label-caps mb-3 block">Filming Checklist</span>
              <ul className="space-y-2">
                {deal.filmingChecklist.map((item, index) => (
                  <li key={item.id}>
                    <label className="flex items-center gap-3 font-body text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => onToggleChecklist(item.id)}
                        className="accent-checkbox h-4 w-4"
                      />
                      Video {index + 1}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={onDelete}
            className="flex w-full items-center justify-center gap-2 border border-border-warm py-3 font-body text-sm text-stone transition hover:border-tier-deadline hover:text-tier-deadline"
          >
            <Trash2 className="h-4 w-4" />
            Delete Deal
          </button>
        </div>
      </div>
    </div>
  )
}

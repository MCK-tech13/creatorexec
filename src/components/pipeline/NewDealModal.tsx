import { useEffect, useState } from 'react'
import type { BrandDealInsert, DealStage } from '../../types/pipeline'
import { DEAL_STAGES } from '../../types/pipeline'
import { clearClientFormDirty, markClientFormDirty } from '../../lib/version/formDirtyRegistry'
import { RetainerFields } from './RetainerFields'

interface NewDealModalProps {
  onClose: () => void
  onSubmit: (deal: BrandDealInsert) => void
}

const FORM_ID = 'retainer-new-deal'

export function NewDealModal({ onClose, onSubmit }: NewDealModalProps) {
  const [brandName, setBrandName] = useState('')
  const [stage, setStage] = useState<DealStage>('negotiating')
  const [isRetainer, setIsRetainer] = useState(false)
  const [retainerTotalVideos, setRetainerTotalVideos] = useState<number | undefined>()
  const [retainerDeadlineDate, setRetainerDeadlineDate] = useState<string | undefined>()

  const canSubmit = brandName.trim().length > 0
  const isDirty =
    brandName.trim().length > 0 ||
    stage !== 'negotiating' ||
    isRetainer ||
    retainerTotalVideos != null ||
    Boolean(retainerDeadlineDate)

  useEffect(() => {
    if (isDirty) markClientFormDirty(FORM_ID)
    else clearClientFormDirty(FORM_ID)
    return () => clearClientFormDirty(FORM_ID)
  }, [isDirty])

  const handleSubmit = () => {
    clearClientFormDirty(FORM_ID)
    onSubmit({
      brandName: brandName.trim(),
      stage,
      isRetainer,
      retainerTotalVideos: isRetainer ? retainerTotalVideos : undefined,
      retainerDeadlineDate: isRetainer ? retainerDeadlineDate : undefined,
    })
    onClose()
  }

  const handleClose = () => {
    clearClientFormDirty(FORM_ID)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-border-warm bg-white p-8 fade-in">
        <h2 className="font-display text-2xl font-bold text-ink">New Deal</h2>
        <p className="form-helper-text mt-2 font-body text-sm text-stone">
          Brand name and stage are all you need — add retainer details now or later.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label htmlFor="new-deal-brand" className="label-caps mb-2 block">
              Brand Name <span className="text-emerald">*</span>
            </label>
            <input
              id="new-deal-brand"
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="input-field w-full px-4 py-3"
              placeholder="e.g. GlowLab"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="new-deal-stage" className="label-caps mb-2 block">
              Stage <span className="text-emerald">*</span>
            </label>
            <select
              id="new-deal-stage"
              value={stage}
              onChange={(e) => setStage(e.target.value as DealStage)}
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
            isRetainer={isRetainer}
            onIsRetainerChange={setIsRetainer}
            totalVideos={retainerTotalVideos}
            onTotalVideosChange={setRetainerTotalVideos}
            deadlineDate={retainerDeadlineDate}
            onDeadlineChange={setRetainerDeadlineDate}
            videosCompleted={0}
            showProgress={false}
          />
        </div>

        <div className="mt-8 flex gap-3">
          <button type="button" onClick={handleClose} className="btn-outline flex-1 py-3">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="btn-primary flex-1 py-3"
          >
            Create Deal
          </button>
        </div>
      </div>
    </div>
  )
}

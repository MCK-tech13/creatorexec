import { useRef, useState } from 'react'
import { ProductChoosingTips } from '../sample/ProductChoosingTips'
import { EditorialMark } from '../ui/EditorialMark'

interface SprintEmptyStateProps {
  onAddSamples: () => void
  onUploadReport: () => void
  onAddRetainerDeal: () => void
}

export function SprintEmptyState({
  onAddSamples,
  onUploadReport,
  onAddRetainerDeal,
}: SprintEmptyStateProps) {
  const [tipsOpen, setTipsOpen] = useState(false)
  const tipsRef = useRef<HTMLDivElement>(null)

  const showProductTips = () => {
    setTipsOpen(true)
    requestAnimationFrame(() => {
      tipsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  return (
    <div className="fade-in">
      <div className="flex flex-col items-center text-center">
        <div className="mb-5 flex justify-center">
          <EditorialMark />
        </div>
        <h2 className="font-display text-3xl font-bold text-ink md:text-4xl">
          Nothing to schedule yet
        </h2>
        <p className="mt-4 font-body text-base text-stone">
          Add your samples, upload your commission report, or add a retainer deal to build your
          first sprint.
        </p>
        <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
          <button type="button" onClick={onAddSamples} className="btn-outline w-full py-3">
            Add Samples
          </button>
          <button type="button" onClick={onUploadReport} className="btn-primary w-full py-3">
            Upload Report
          </button>
          <button type="button" onClick={onAddRetainerDeal} className="btn-outline w-full py-3">
            Add Retainer Deal
          </button>
        </div>
        <button
          type="button"
          onClick={showProductTips}
          className="link-elegant mt-8 font-body text-sm text-stone"
        >
          New here? See how to choose your first products
        </button>
      </div>

      <div ref={tipsRef} className="mt-10 w-full">
        <ProductChoosingTips
          id="empty-state-product-choosing-tips"
          open={tipsOpen}
          onOpenChange={setTipsOpen}
        />
      </div>
    </div>
  )
}

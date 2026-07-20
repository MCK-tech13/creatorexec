import { useRef, useState } from 'react'
import { ProductChoosingTips } from '../sample/ProductChoosingTips'
import { EditorialMark } from '../ui/EditorialMark'

interface SprintEmptyStateProps {
  onAddSamples: () => void
  onUploadReport: () => void
  onAddRetainerDeal: () => void
  /** Durable catalog products that survive Start Over (Stage 2). */
  catalogProductCount?: number
  onContinueWithCatalog?: () => void
}

export function SprintEmptyState({
  onAddSamples,
  onUploadReport,
  onAddRetainerDeal,
  catalogProductCount = 0,
  onContinueWithCatalog,
}: SprintEmptyStateProps) {
  const [tipsOpen, setTipsOpen] = useState(false)
  const tipsRef = useRef<HTMLDivElement>(null)
  const hasCatalog = catalogProductCount > 0 && Boolean(onContinueWithCatalog)

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
        <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl md:text-4xl">
          {hasCatalog ? 'Ready for your next sprint?' : 'Nothing to schedule yet'}
        </h2>
        <p className="mt-3 font-body text-sm text-stone sm:mt-4 sm:text-base">
          {hasCatalog
            ? `You have ${catalogProductCount} product${catalogProductCount === 1 ? '' : 's'} saved in your catalog. Continue to rebuild your schedule — including unfinished Test trials.`
            : 'Add products to your catalog, upload your commission report, or add a retainer deal to build your first sprint.'}
        </p>
        <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
          {hasCatalog && (
            <button
              type="button"
              onClick={onContinueWithCatalog}
              className="btn-primary w-full py-3"
            >
              Continue with my products
            </button>
          )}
          <button
            type="button"
            onClick={onAddSamples}
            className={hasCatalog ? 'btn-outline w-full py-3' : 'btn-outline w-full py-3'}
          >
            {hasCatalog ? 'Add more products' : 'Add a sample or favorite product'}
          </button>
          <button
            type="button"
            onClick={onUploadReport}
            className={hasCatalog ? 'btn-outline w-full py-3' : 'btn-primary w-full py-3'}
          >
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

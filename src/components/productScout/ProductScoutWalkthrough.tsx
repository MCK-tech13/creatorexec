import { useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import {
  dismissProductScoutWalkthrough,
  isProductScoutWalkthroughDismissed,
  resetProductScoutWalkthroughDismissed,
} from '../../lib/productScout/walkthroughStorage'

/** Drop the final walkthrough clip at public/videos/product-scout-walkthrough.mp4 */
export const PRODUCT_SCOUT_WALKTHROUGH_VIDEO_SRC = '/videos/product-scout-walkthrough.mp4'

interface ProductScoutWalkthroughProps {
  videoSrc?: string
}

function WalkthroughPlaceholder() {
  return (
    <div
      className="flex aspect-[9/16] w-full flex-col items-center justify-center border border-dashed border-blush bg-white px-4 text-center"
      role="img"
      aria-label="Walkthrough video placeholder"
    >
      <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-stone">
        [Walkthrough video placeholder]
      </p>
      <p className="mt-3 font-body text-xs leading-relaxed text-grey">
        Screen recording: TikTok Shop → Promotion info → Product trends (Orders, CTR, Creators,
        ATC users)
      </p>
    </div>
  )
}

export function ProductScoutWalkthrough({
  videoSrc = PRODUCT_SCOUT_WALKTHROUGH_VIDEO_SRC,
}: ProductScoutWalkthroughProps) {
  const [dismissed, setDismissed] = useState(() => isProductScoutWalkthroughDismissed())
  const [collapsed, setCollapsed] = useState(false)
  const [videoAvailable, setVideoAvailable] = useState(true)

  const handleDismiss = () => {
    dismissProductScoutWalkthrough()
    setDismissed(true)
  }

  const handleRestore = () => {
    resetProductScoutWalkthroughDismissed()
    setDismissed(false)
    setCollapsed(false)
  }

  if (dismissed) {
    return (
      <div className="w-full border border-border-warm bg-white px-4 py-3">
        <button
          type="button"
          onClick={handleRestore}
          className="link-elegant font-body text-sm text-emerald"
        >
          Show walkthrough: how to find these numbers →
        </button>
      </div>
    )
  }

  return (
    <section
      className="w-full border border-border-warm bg-blush-tint lg:sticky lg:top-6"
      aria-label="How to find Product Scout metrics"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border-warm px-4 py-3">
        <div className="min-w-0">
          <p className="label-caps">How to find these numbers</p>
          <p className="mt-1 font-body text-xs text-stone sm:text-sm">
            Navigate to TikTok Shop&apos;s Promotion info screen for the four Product trends
            metrics below.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="p-1.5 text-stone transition hover:text-ink"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand walkthrough' : 'Collapse walkthrough'}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 text-stone transition hover:text-ink"
            aria-label="Dismiss walkthrough"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="flex justify-center p-4 sm:p-5">
          <div className="mx-auto w-full max-w-[280px] lg:max-w-none">
            {videoSrc && videoAvailable ? (
              <video
                src={videoSrc}
                controls
                playsInline
                preload="metadata"
                onError={() => setVideoAvailable(false)}
                className="aspect-[9/16] w-full border border-border-warm bg-ink object-cover"
              >
                <track kind="captions" />
              </video>
            ) : (
              <WalkthroughPlaceholder />
            )}
          </div>
        </div>
      )}
    </section>
  )
}

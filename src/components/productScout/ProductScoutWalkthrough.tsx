import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Volume2, VolumeX, X } from 'lucide-react'
import {
  dismissProductScoutWalkthrough,
  isProductScoutWalkthroughDismissed,
  resetProductScoutWalkthroughDismissed,
} from '../../lib/productScout/walkthroughStorage'

/** Web-optimized walkthrough clip (convert source MOV via npm run prepare:walkthrough-video). */
export const PRODUCT_SCOUT_WALKTHROUGH_VIDEO_SRC = '/videos/product-scout-walkthrough.mp4'

interface ProductScoutWalkthroughProps {
  videoSrc?: string
}

export function ProductScoutWalkthrough({
  videoSrc = PRODUCT_SCOUT_WALKTHROUGH_VIDEO_SRC,
}: ProductScoutWalkthroughProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [dismissed, setDismissed] = useState(() => isProductScoutWalkthroughDismissed())
  const [collapsed, setCollapsed] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [muted, setMuted] = useState(true)

  const handleDismiss = () => {
    videoRef.current?.pause()
    dismissProductScoutWalkthrough()
    setDismissed(true)
  }

  const handleRestore = () => {
    resetProductScoutWalkthroughDismissed()
    setDismissed(false)
    setCollapsed(false)
    setVideoError(false)
    setMuted(true)
  }

  const toggleMuted = () => {
    setMuted((value) => !value)
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video || dismissed || collapsed || videoError) {
      video?.pause()
      return
    }

    video.muted = muted

    const playVideo = async () => {
      try {
        await video.play()
      } catch {
        // Browser may block autoplay; controls remain available.
      }
    }

    void playVideo()
  }, [collapsed, dismissed, muted, videoError, videoSrc])

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
            {videoError ? (
              <p className="border border-border-warm bg-white px-4 py-6 text-center font-body text-sm text-stone">
                Walkthrough video could not be loaded. Try refreshing the page.
              </p>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={toggleMuted}
                  className="absolute right-2 top-2 z-10 inline-flex items-center gap-1.5 border border-border-warm bg-white/95 px-2.5 py-1.5 font-body text-xs font-medium text-ink shadow-sm transition hover:border-emerald/40 hover:text-emerald"
                  aria-label={muted ? 'Unmute walkthrough' : 'Mute walkthrough'}
                  aria-pressed={!muted}
                >
                  {muted ? (
                    <VolumeX className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                  <span>{muted ? 'Unmute' : 'Mute'}</span>
                </button>
                <video
                  ref={videoRef}
                  key={videoSrc}
                  src={videoSrc}
                  autoPlay
                  muted={muted}
                  controls
                  playsInline
                  preload="auto"
                  onError={() => setVideoError(true)}
                  className="aspect-[9/16] w-full border border-border-warm bg-ink object-contain"
                  aria-label="Screen recording: TikTok Shop promotion info and Product trends metrics"
                >
                  <track kind="captions" />
                </video>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

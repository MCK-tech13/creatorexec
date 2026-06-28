import {
  getVideoProgressColor,
  isReadyForTierReview,
  TIER_REVIEW_VIDEO_COUNT,
} from '../../lib/dashboard/videoProgress'

interface VideoProgressBarProps {
  filmed: number
  showBadge?: boolean
}

export function VideoProgressBar({ filmed, showBadge = true }: VideoProgressBarProps) {
  const pct = Math.min(100, (filmed / TIER_REVIEW_VIDEO_COUNT) * 100)
  const color = getVideoProgressColor(filmed)
  const ready = isReadyForTierReview(filmed)

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 font-sans text-xs tabular-nums text-stone">
          {filmed}/{TIER_REVIEW_VIDEO_COUNT}
        </span>
      </div>
      {showBadge && ready && (
        <span className="inline-flex rounded-full border border-emerald/30 bg-emerald/10 px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-wide text-emerald">
          Ready for tier review
        </span>
      )}
    </div>
  )
}

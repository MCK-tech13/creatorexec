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
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-3">
        <div className="h-1 min-w-[120px] flex-1 overflow-hidden bg-track">
          <div
            className={`h-full transition-all duration-300 ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 font-body text-xs tabular-nums text-stone">
          {filmed}/{TIER_REVIEW_VIDEO_COUNT}
        </span>
      </div>
      {showBadge && ready && (
        <span className="label-caps inline-flex text-emerald">Ready for tier review</span>
      )}
    </div>
  )
}

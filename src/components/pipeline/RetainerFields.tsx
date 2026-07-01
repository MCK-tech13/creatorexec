import type { RetainerProgress } from '../../lib/pipeline/retainerUtils'

interface RetainerFieldsProps {
  isRetainer: boolean
  onIsRetainerChange: (value: boolean) => void
  totalVideos: number | undefined
  onTotalVideosChange: (value: number | undefined) => void
  deadlineDate: string | undefined
  onDeadlineChange: (value: string | undefined) => void
  videosCompleted: number
  retainerProgress?: RetainerProgress | null
  showProgress?: boolean
}

export function RetainerFields({
  isRetainer,
  onIsRetainerChange,
  totalVideos,
  onTotalVideosChange,
  deadlineDate,
  onDeadlineChange,
  videosCompleted,
  retainerProgress,
  showProgress = true,
}: RetainerFieldsProps) {
  return (
    <div
      className={`border p-5 transition-colors ${
        isRetainer ? 'border-emerald bg-blush-tint' : 'border-border-warm bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <label className="flex cursor-pointer items-center gap-3 font-body text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={isRetainer}
            onChange={(e) => onIsRetainerChange(e.target.checked)}
            className="accent-checkbox h-4 w-4 shrink-0"
          />
          Is this a retainer?
        </label>
        <button
          type="button"
          onClick={() => onIsRetainerChange(!isRetainer)}
          className={`font-body text-xs font-medium uppercase tracking-[0.12em] ${
            isRetainer ? 'text-emerald' : 'text-stone'
          }`}
        >
          {isRetainer ? 'Retainer on' : 'Retainer off'}
        </button>
      </div>

      {isRetainer ? (
        <div className="mt-5 space-y-4 border-t border-emerald/20 pt-5">
          <div>
            <label className="label-caps mb-2 block">Total Videos Required</label>
            <input
              type="number"
              min={1}
              value={totalVideos ?? ''}
              onChange={(e) =>
                onTotalVideosChange(
                  e.target.value ? parseInt(e.target.value, 10) : undefined,
                )
              }
              className="input-field w-full bg-white px-4 py-3"
              placeholder="e.g. 12"
            />
          </div>
          <div>
            <label className="label-caps mb-2 block">Deadline Date</label>
            <input
              type="date"
              value={deadlineDate ?? ''}
              onChange={(e) => onDeadlineChange(e.target.value || undefined)}
              className="input-field w-full bg-white px-4 py-3"
            />
          </div>
          <p className="font-body text-sm text-ink">
            Videos completed: {videosCompleted}
            {totalVideos != null && totalVideos > 0 && ` of ${totalVideos}`}
          </p>

          {showProgress && retainerProgress && retainerProgress.total > 0 && (
            <div className="border border-border-warm bg-white p-4">
              <p className="font-body text-sm text-ink">
                {retainerProgress.completed} of {retainerProgress.total} videos completed
                {retainerProgress.remaining > 0 && retainerProgress.daysRemaining > 0 && (
                  <>
                    {' '}
                    — {retainerProgress.videosPerDay} video
                    {retainerProgress.videosPerDay !== 1 ? 's' : ''} needed per day to hit your
                    deadline
                  </>
                )}
              </p>
              <div className="mt-3 h-px w-full bg-track">
                <div
                  className="h-px bg-blush transition-all"
                  style={{
                    width: `${(retainerProgress.completed / retainerProgress.total) * 100}%`,
                  }}
                />
              </div>
              {retainerProgress.behindPace && (
                <p className="mt-3 font-body text-sm font-medium text-tier-deadline">
                  You&apos;re behind pace on this retainer — consider adjusting your schedule.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="form-helper-text mt-3 font-body text-xs text-stone">
          Enable to set video count, deadline, and auto-sync to your sprint schedule.
        </p>
      )}
    </div>
  )
}

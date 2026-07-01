import type { SprintConfig, SprintDays } from '../../types'
import { loadOnboardingProfile } from '../../lib/onboarding/storage'

interface SprintConfigFormProps {
  config: SprintConfig
  onChange: (config: SprintConfig) => void
  onSubmit: () => void
  onBack: () => void
}

const SPRINT_OPTIONS: SprintDays[] = [3, 7, 14]

export function SprintConfigForm({
  config,
  onChange,
  onSubmit,
  onBack,
}: SprintConfigFormProps) {
  const totalVideos = config.videosPerDay * config.sprintDays
  const videosValid = Number.isInteger(config.videosPerDay) && config.videosPerDay >= 1
  const onboardingVideos = loadOnboardingProfile()?.videosPerDay

  return (
    <div>
      <div className="mb-10 text-center">
        <h2 className="font-display text-3xl font-bold text-ink md:text-4xl">Configure Your Sprint</h2>
        <p className="mt-5 font-body text-base leading-relaxed text-stone">
          Tell us your posting volume and sprint length to generate a personalized filming
          schedule.
        </p>
      </div>

      <div className="space-y-8 border border-border-warm p-8">
        <div>
          <label htmlFor="videosPerDay" className="label-caps mb-4 block">
            Videos per day
          </label>
          <input
            id="videosPerDay"
            type="number"
            min={1}
            step={1}
            value={config.videosPerDay}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10)
              if (!Number.isNaN(val) && val >= 1) {
                onChange({ ...config, videosPerDay: val })
              } else if (e.target.value === '') {
                onChange({ ...config, videosPerDay: 1 })
              }
            }}
            className="input-field w-full px-4 py-4"
          />
          {onboardingVideos != null && onboardingVideos >= 1 && (
            <p className="form-helper-text mt-3 font-body text-xs text-stone">
              Pre-filled from your onboarding answer ({onboardingVideos} videos/day). Adjust if
              needed.
            </p>
          )}
          <p className="form-helper-text mt-3 font-body text-xs text-stone">
            No maximum — enter your actual daily output (e.g. 5, 20, 30+)
          </p>
        </div>

        <div>
          <span className="label-caps mb-4 block">Sprint length</span>
          <div className="grid grid-cols-3 gap-px bg-border-warm">
            {SPRINT_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onChange({ ...config, sprintDays: days })}
                className={`py-4 font-body text-sm font-medium transition ${
                  config.sprintDays === days
                    ? 'bg-emerald text-white'
                    : 'bg-white text-stone hover:border-blush hover:text-ink'
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>

        <div className="border-t-2 border-emerald pt-7 text-center">
          <p className="label-caps">Total videos this sprint</p>
          <p className="font-display mt-2 text-4xl font-bold text-ink md:text-5xl">{totalVideos}</p>
        </div>
      </div>

      <div className="mt-10 flex gap-px">
        <button type="button" onClick={onBack} className="btn-outline flex-1 py-4">
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!videosValid}
          className="btn-primary flex-1 py-4 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Generate Schedule
        </button>
      </div>
    </div>
  )
}

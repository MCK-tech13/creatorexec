import type { SprintConfig, SprintDays } from '../../types'

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

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8 text-center">
        <h2 className="font-heading text-3xl font-semibold text-ink">Configure Your Sprint</h2>
        <p className="mt-2 font-sans text-sm text-stone">
          Tell us your posting volume and sprint length to generate a personalized filming
          schedule.
        </p>
      </div>

      <div className="card-panel space-y-6 p-6">
        <div>
          <label htmlFor="videosPerDay" className="mb-2 block font-sans text-sm font-medium text-ink">
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
            className="input-field w-full px-4 py-3"
          />
          <p className="mt-1.5 font-sans text-xs text-stone">
            No maximum — enter your actual daily output (e.g. 5, 20, 30+)
          </p>
        </div>

        <div>
          <span className="mb-2 block font-sans text-sm font-medium text-ink">Sprint length</span>
          <div className="grid grid-cols-3 gap-2">
            {SPRINT_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onChange({ ...config, sprintDays: days })}
                className={`rounded-xl border py-3 font-sans text-sm font-medium transition ${
                  config.sprintDays === days
                    ? 'border-emerald bg-emerald/10 text-emerald'
                    : 'border-border-warm bg-cream text-stone hover:border-emerald/30 hover:text-ink'
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border-warm bg-cream px-4 py-3 text-center">
          <p className="font-sans text-sm text-stone">Total videos this sprint</p>
          <p className="font-heading text-3xl font-semibold text-emerald">{totalVideos}</p>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button type="button" onClick={onBack} className="btn-secondary flex-1 py-3 text-sm">
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!videosValid}
          className="btn-primary flex-1 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate Schedule
        </button>
      </div>
    </div>
  )
}

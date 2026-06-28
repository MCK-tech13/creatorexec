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
      <div className="mb-10 text-center">
        <h2 className="font-display text-3xl font-bold text-ink">Configure Your Sprint</h2>
        <p className="mt-3 font-sans text-sm leading-relaxed text-stone">
          Tell us your posting volume and sprint length to generate a personalized filming
          schedule.
        </p>
      </div>

      <div className="card-panel space-y-8 p-8">
        <div>
          <label
            htmlFor="videosPerDay"
            className="label-caps mb-3 block"
          >
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
          <p className="mt-2 font-sans text-xs text-stone">
            No maximum — enter your actual daily output (e.g. 5, 20, 30+)
          </p>
        </div>

        <div>
          <span className="label-caps mb-3 block">
            Sprint length
          </span>
          <div className="grid grid-cols-3 gap-2">
            {SPRINT_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onChange({ ...config, sprintDays: days })}
                className={`border py-3 font-sans text-sm font-medium transition ${
                  config.sprintDays === days
                    ? 'border-emerald bg-emerald text-white'
                    : 'border-border-warm bg-cream-card text-stone hover:border-emerald/40 hover:text-emerald'
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>

        <div className="border-l-[3px] border-emerald bg-cream px-6 py-6 text-center">
          <p className="label-caps">Total videos this sprint</p>
          <p className="font-display mt-2 text-5xl font-bold text-ink">{totalVideos}</p>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <button type="button" onClick={onBack} className="btn-outline flex-1 py-3 text-sm">
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!videosValid}
          className="btn-primary flex-1 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Generate Schedule
        </button>
      </div>
    </div>
  )
}

import type { ScheduleMode } from '../../types'

interface ScheduleModeSelectorProps {
  mode: ScheduleMode
  onChange: (mode: ScheduleMode) => void
}

const OPTIONS: Array<{ value: ScheduleMode; label: string; hint: string }> = [
  {
    value: 'full',
    label: 'Full',
    hint: 'Anchor / Rising / Test / Cut from sales score',
  },
  {
    value: 'momentum',
    label: 'Momentum',
    hint: 'Rising / Test only — early catalog',
  },
  {
    value: 'sop',
    label: 'SOP',
    hint: 'Creator SOP Top / Mid / Band A·B ranking',
  },
]

export function ScheduleModeSelector({ mode, onChange }: ScheduleModeSelectorProps) {
  return (
    <div>
      <span className="label-caps mb-3 block">Analysis mode</span>
      <div className="grid grid-cols-1 gap-px bg-border-warm sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const active = mode === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={`px-4 py-4 text-left transition ${
                active
                  ? 'bg-emerald text-white'
                  : 'bg-white text-stone hover:text-ink'
              }`}
            >
              <span className="block font-body text-sm font-medium">{option.label}</span>
              <span
                className={`mt-1 block font-body text-xs leading-snug ${
                  active ? 'text-white/80' : 'text-grey'
                }`}
              >
                {option.hint}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

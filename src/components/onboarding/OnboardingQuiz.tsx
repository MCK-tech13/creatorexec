import { useState } from 'react'
import type {
  FilmingApproach,
  MonthlyCommissionLevel,
  OnboardingProfile,
} from '../../types/onboarding'
import {
  buildOnboardingAnswers,
  resolveModeFromAnswers,
} from '../../lib/onboarding/modeLogic'

interface OnboardingQuizProps {
  onComplete: (profile: OnboardingProfile) => void
}

const COMMISSION_OPTIONS: { value: MonthlyCommissionLevel; label: string }[] = [
  { value: 'just_starting', label: 'Just getting started (under $500/month)' },
  { value: 'growing', label: 'Growing ($500 – $2,000/month)' },
  { value: 'established', label: 'Established ($2,000+/month)' },
]

const APPROACH_OPTIONS: { value: FilmingApproach; label: string }[] = [
  { value: 'whatever_samples', label: 'I just film whatever samples I have' },
  { value: 'rough_system', label: "I have a rough system but it's not consistent" },
  { value: 'solid_system', label: 'I have a solid system I follow every sprint' },
]

export function OnboardingQuiz({ onComplete }: OnboardingQuizProps) {
  const [step, setStep] = useState(0)
  const [monthlyCommission, setMonthlyCommission] = useState<MonthlyCommissionLevel | null>(null)
  const [videosPerDay, setVideosPerDay] = useState('5')
  const [filmingApproach, setFilmingApproach] = useState<FilmingApproach | null>(null)

  const parsedVideos = parseInt(videosPerDay, 10)
  const videosValid = Number.isInteger(parsedVideos) && parsedVideos >= 1

  const canContinue =
    step === 0
      ? monthlyCommission !== null
      : step === 1
        ? videosValid
        : filmingApproach !== null

  const advance = () => {
    if (!canContinue) return
    if (step < 2) {
      setStep((s) => s + 1)
      return
    }
    if (monthlyCommission === null || filmingApproach === null || !videosValid) return

    const answers = buildOnboardingAnswers(monthlyCommission, parsedVideos, filmingApproach)
    const mode = resolveModeFromAnswers(answers)
    onComplete({
      completed: true,
      mode,
      videosPerDay: parsedVideos,
      answers,
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-16">
        <div className="w-full max-w-xl">
          <p className="label-caps mb-8 text-center">{step + 1} / 3</p>

          {step === 0 && (
            <div className="fade-in">
              <h1 className="font-display text-center text-3xl leading-snug font-bold text-ink md:text-4xl">
                What does your monthly TikTok Shop commission look like?
              </h1>
              <div className="mt-10 space-y-3">
                {COMMISSION_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt.value}
                    label={opt.label}
                    selected={monthlyCommission === opt.value}
                    onSelect={() => setMonthlyCommission(opt.value)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="fade-in">
              <h1 className="font-display text-center text-3xl leading-snug font-bold text-ink md:text-4xl">
                How many videos do you post per day?
              </h1>
              <div className="mt-10">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={videosPerDay}
                  onChange={(e) => setVideosPerDay(e.target.value)}
                  className="input-field w-full px-5 py-4 text-center font-sans text-2xl font-semibold text-ink"
                  aria-label="Videos per day"
                />
                <p className="mt-4 text-center font-sans text-sm text-stone">
                  Enter your typical daily output — minimum 1
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="fade-in">
              <h1 className="font-display text-center text-3xl leading-snug font-bold text-ink md:text-4xl">
                How do you currently decide what to film?
              </h1>
              <div className="mt-10 space-y-3">
                {APPROACH_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt.value}
                    label={opt.label}
                    selected={filmingApproach === opt.value}
                    onSelect={() => setFilmingApproach(opt.value)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-12 flex justify-center">
            {step < 2 ? (
              <button
                type="button"
                onClick={advance}
                disabled={!canContinue}
                className="btn-primary min-w-[200px] px-10 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={advance}
                disabled={!canContinue}
                className="btn-primary min-w-[200px] px-10 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function OptionCard({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full border px-6 py-5 text-left font-sans text-base leading-relaxed transition ${
        selected
          ? 'border-emerald bg-emerald-muted text-ink'
          : 'border-border-warm bg-cream-card text-ink hover:border-emerald/40'
      }`}
    >
      {label}
    </button>
  )
}

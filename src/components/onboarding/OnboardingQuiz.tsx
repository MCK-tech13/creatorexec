import { useState } from 'react'
import { Check } from 'lucide-react'
import { PageContainer } from '../layout/PageContainer'
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
  embedded?: boolean
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

export function OnboardingQuiz({ onComplete, embedded = false }: OnboardingQuizProps) {
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

  const quizContent = (
    <>
      {step === 0 && (
        <div key="step-0" className="animate-quiz-question">
          <h1 className="font-display text-center text-2xl leading-tight font-bold text-ink sm:text-3xl md:text-4xl">
            What does your monthly TikTok Shop commission look like?
          </h1>
          <div className="mt-10 space-y-2">
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
        <div key="step-1" className="animate-quiz-question">
          <h1 className="font-display text-center text-2xl leading-tight font-bold text-ink sm:text-3xl md:text-4xl">
            How many videos do you post per day?
          </h1>
          <div className="mt-10">
            <input
              type="number"
              min={1}
              step={1}
              value={videosPerDay}
              onChange={(e) => setVideosPerDay(e.target.value)}
              className="input-field w-full px-5 py-4 text-center font-body text-xl font-semibold text-ink"
              aria-label="Videos per day"
            />
            <p className="form-helper-text mt-4 text-center font-body text-sm text-stone">
              Enter your typical daily output — minimum 1
            </p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div key="step-2" className="animate-quiz-question">
          <h1 className="font-display text-center text-2xl leading-tight font-bold text-ink sm:text-3xl md:text-4xl">
            How do you currently decide what to film?
          </h1>
          <div className="mt-10 space-y-2">
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

      <div className="mt-14">
        <button
          type="button"
          onClick={advance}
          disabled={!canContinue}
          className="btn-primary w-full py-4"
        >
          {step < 2 ? 'Continue' : 'Get Started'}
        </button>
      </div>
    </>
  )

  const quizBody = embedded ? (
    <div className="mx-auto w-full max-w-xl">
      {quizContent}
    </div>
  ) : (
    <PageContainer className="flex flex-1 flex-col items-center py-12 sm:py-16 md:py-20">
      <p className="mb-8 font-body text-xs tracking-[0.12em] text-grey-light sm:mb-12">
        {step + 1} / 3
      </p>
      <div className="w-full max-w-xl">{quizContent}</div>
    </PageContainer>
  )

  if (embedded) {
    return (
      <div className="fade-in">
        <p className="mb-8 font-body text-xs tracking-[0.12em] text-grey-light sm:mb-10">
          Sprint setup · {step + 1} / 3
        </p>
        {quizBody}
      </div>
    )
  }

  return <div className="flex min-h-screen flex-col bg-cream-warm">{quizBody}</div>
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
      className={`flex w-full items-center justify-between gap-3 border bg-transparent px-5 py-3.5 text-left font-body text-base transition ${
        selected
          ? 'border-border-warm border-l-2 border-l-terracotta bg-terracotta-tint font-medium text-ink'
          : 'border-border-warm text-ink hover:border-terracotta/60'
      }`}
    >
      <span>{label}</span>
      {selected && <Check className="h-4 w-4 shrink-0 text-emerald" strokeWidth={2} />}
    </button>
  )
}

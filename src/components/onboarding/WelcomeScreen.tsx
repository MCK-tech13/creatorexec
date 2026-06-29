import { REPORT_DOWNLOAD_STEPS } from '../../lib/onboarding/reportDownloadSteps'
import { EditorialMark } from '../ui/EditorialMark'

interface WelcomeScreenProps {
  onContinue: () => void
}

const STEP_BASE_DELAY = 0.4

export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  const buttonDelay = STEP_BASE_DELAY + REPORT_DOWNLOAD_STEPS.length * 0.1 + 0.1

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 md:py-20">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-12 text-center">
            <div className="inline-flex flex-col items-center">
              <h1 className="font-display text-5xl font-bold text-ink md:text-6xl">
                CreatorExec
              </h1>
              <div className="mt-3 h-px w-[60px] bg-emerald" aria-hidden />
            </div>
          </div>

          <div className="text-center">
            <div
              className="animate-welcome-fade mb-5 flex justify-center"
              style={{ animationDelay: '0.15s' }}
            >
              <EditorialMark />
            </div>
            <h2
              className="animate-welcome-headline font-display mx-auto max-w-md text-2xl font-bold leading-snug text-ink md:text-3xl"
            >
              Your TikTok Shop command center.
            </h2>
            <p
              className="animate-welcome-fade mx-auto mt-6 max-w-lg font-body text-base text-stone"
              style={{ animationDelay: '0.2s' }}
            >
              CreatorExec analyzes your commission data, ranks your products by performance, and
              builds a personalized filming schedule for your next sprint — so you always know
              exactly what to film and when.
            </p>
          </div>

          <section className="mt-14">
            <div className="h-px w-full bg-border-warm" aria-hidden />
            <h3 className="py-6 text-center font-body text-xs font-semibold uppercase tracking-[0.18em] text-stone">
              Before you begin
            </h3>
            <div className="h-px w-full bg-border-warm" aria-hidden />
            <ol className="mt-8 space-y-5 font-body text-base text-stone">
              {REPORT_DOWNLOAD_STEPS.map((step, index) => (
                <li
                  key={step}
                  className="animate-welcome-fade flex items-start gap-3"
                  style={{ animationDelay: `${STEP_BASE_DELAY + index * 0.1}s` }}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald text-[11px] font-medium text-white">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <div
            className="animate-welcome-fade mt-14"
            style={{ animationDelay: `${buttonDelay}s` }}
          >
            <button type="button" onClick={onContinue} className="btn-primary w-full py-4">
              Get Started →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

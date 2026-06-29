import { REPORT_DOWNLOAD_STEPS } from '../../lib/onboarding/reportDownloadSteps'

interface WelcomeScreenProps {
  onContinue: () => void
}

export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-16">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-12 text-center">
            <div className="inline-block">
              <h1 className="font-display text-5xl font-bold tracking-tight text-ink md:text-6xl">
                CreatorExec
              </h1>
              <div className="mt-2 h-0.5 w-full bg-emerald" aria-hidden />
            </div>
          </div>

          <div className="text-center">
            <h2 className="font-display text-3xl font-semibold leading-snug text-ink md:text-4xl">
              Your TikTok Shop command center.
            </h2>
            <p className="mx-auto mt-6 max-w-lg font-body text-base leading-relaxed text-stone md:text-lg">
              CreatorExec analyzes your commission data, ranks your products by performance, and
              builds a personalized filming schedule for your next sprint — so you always know
              exactly what to film and when.
            </p>
          </div>

          <section className="mt-14">
            <h3 className="text-center font-body text-sm font-semibold uppercase tracking-[0.12em] text-stone">
              Before you begin
            </h3>
            <ol className="mt-8 space-y-5 font-body text-[0.9375rem] leading-relaxed text-stone">
              {REPORT_DOWNLOAD_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="shrink-0 font-medium text-grey">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="mt-14 flex justify-center">
            <button
              type="button"
              onClick={onContinue}
              className="btn-primary min-w-[220px] px-10 py-3.5 font-body text-base"
            >
              Get Started →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

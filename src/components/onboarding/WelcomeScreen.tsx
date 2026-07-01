import { PageContainer } from '../layout/PageContainer'
import { EditorialMark } from '../ui/EditorialMark'

interface WelcomeScreenProps {
  onContinue: () => void
}

const WHATS_INSIDE = [
  {
    label: 'Sprint Scheduling',
    description:
      'Upload your commission report and get a personalized filming schedule, ranked by product performance.',
  },
  {
    label: 'Retainer Deal Tracking',
    description:
      'Manage brand deals from negotiation to signed, with video requirements auto-added to your sprint.',
  },
  {
    label: 'Income Tracker',
    description:
      'Log your monthly GMV, commission, and brand deal income in one place — no more spreadsheets.',
  },
  {
    label: 'Product Tiering',
    description:
      "Every product ranked Anchor, Rising, Test, or Cut, so you always know what's worth filming.",
  },
] as const

export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PageContainer className="flex flex-1 flex-col items-center justify-center py-16 md:py-20">
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
            <h2 className="animate-welcome-headline font-display mx-auto max-w-md text-2xl font-bold leading-snug text-ink md:text-3xl">
              Your TikTok Shop command center.
            </h2>
            <p
              className="animate-welcome-fade mx-auto mt-6 max-w-lg font-body text-base text-stone"
              style={{ animationDelay: '0.2s' }}
            >
              Everything you need to run your TikTok Shop business, all in one place.
            </p>
          </div>

          <section
            className="animate-welcome-fade mt-14"
            style={{ animationDelay: '0.35s' }}
            aria-labelledby="whats-inside-heading"
          >
            <h3
              id="whats-inside-heading"
              className="font-display text-center text-2xl font-bold text-ink md:text-3xl"
            >
              What&apos;s Inside
            </h3>
            <ul className="mt-10 space-y-4">
              {WHATS_INSIDE.map((item) => (
                <li
                  key={item.label}
                  className="border border-border-warm bg-white p-6 text-left"
                >
                  <p className="font-body text-base font-semibold text-emerald">{item.label}</p>
                  <p className="mt-2 font-body text-base leading-relaxed text-stone">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <p
            className="animate-welcome-fade mx-auto mt-14 max-w-lg text-center font-body text-sm font-normal text-stone"
            style={{ animationDelay: '0.28s' }}
          >
            Takes 30 seconds. Then your schedule&apos;s ready.
          </p>

          <div className="animate-welcome-fade mt-3" style={{ animationDelay: '0.45s' }}>
            <button
              type="button"
              onClick={onContinue}
              className="btn-primary inline-flex w-full items-center justify-center px-8 py-4"
            >
              Get Started →
            </button>
          </div>
      </PageContainer>
    </div>
  )
}

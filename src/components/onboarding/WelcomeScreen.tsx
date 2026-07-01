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
      <PageContainer className="flex flex-1 flex-col items-center justify-center py-12 sm:py-16 md:py-20">
          <div className="mb-8 text-center sm:mb-12">
            <div className="inline-flex flex-col items-center">
              <h1 className="font-display text-4xl font-bold text-ink sm:text-5xl md:text-6xl">
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
            <h2 className="animate-welcome-headline font-display mx-auto max-w-md text-xl font-bold leading-snug text-ink sm:text-2xl md:text-3xl">
              Your TikTok Shop command center.
            </h2>
            <p
              className="animate-welcome-fade mx-auto mt-4 max-w-lg font-body text-sm text-stone sm:mt-6 sm:text-base"
              style={{ animationDelay: '0.2s' }}
            >
              Everything you need to run your TikTok Shop business, all in one place.
            </p>
          </div>

          <section
            className="animate-welcome-fade mt-10 sm:mt-14"
            style={{ animationDelay: '0.35s' }}
            aria-labelledby="whats-inside-heading"
          >
            <h3
              id="whats-inside-heading"
              className="font-display text-center text-xl font-bold text-ink sm:text-2xl md:text-3xl"
            >
              What&apos;s Inside
            </h3>
            <ul className="mt-6 space-y-3 sm:mt-10 sm:space-y-4">
              {WHATS_INSIDE.map((item) => (
                <li
                  key={item.label}
                  className="border border-border-warm bg-white p-4 text-left sm:p-6"
                >
                  <p className="font-body text-sm font-semibold text-emerald sm:text-base">{item.label}</p>
                  <p className="mt-2 font-body text-sm leading-relaxed text-stone sm:text-base">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <p
            className="animate-welcome-fade mx-auto mt-10 max-w-lg text-center font-body text-sm font-normal text-stone sm:mt-14"
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

import { useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PageContainer } from '../layout/PageContainer'
import { CreatorExecWordmark } from '../ui/CreatorExecWordmark'
import { FounderVideo } from './FounderVideo'

const WHATS_INSIDE = [
  {
    label: 'Sprint Scheduling',
    description:
      'Upload your commission report and get a personalized filming schedule, ranked by product performance.',
  },
  {
    label: 'Product Scout',
    description:
      'Score new products before you commit — see demand, competition, and conversion at a glance.',
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

export function WelcomeScreen() {
  const whatsInsideRef = useRef<HTMLElement>(null)

  const scrollToWhatsInside = useCallback(() => {
    whatsInsideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-cream-warm">
      <div className="border-b border-border-warm bg-white">
        <PageContainer className="max-w-5xl">
          <div className="flex items-center justify-between gap-4 py-4">
            <CreatorExecWordmark as="p" variant="light" size="compact" />
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="link-elegant font-body text-sm font-medium text-stone"
              >
                Log in
              </Link>
              <Link to="/signup" className="btn-primary inline-flex px-4 py-2.5 font-body text-sm">
                Sign up
              </Link>
            </div>
          </div>
        </PageContainer>
      </div>
      {/* Section 1 — Hero */}
      <section className="border-b border-border-warm bg-terracotta-tint/40 py-12 sm:py-16 md:py-20">
        <PageContainer className="max-w-4xl">
          <div className="flex justify-center lg:justify-start">
            <CreatorExecWordmark as="p" variant="light" size="compact" />
          </div>

          <div className="mt-8 lg:mt-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
            <div className="text-center lg:text-left">
              <h1 className="font-display text-[1.625rem] font-bold leading-snug text-ink sm:text-3xl md:text-4xl md:leading-tight lg:text-[2.375rem]">
                You&apos;re running a business across four different tabs, a notes app, and your
                memory. It shouldn&apos;t take that much to know what&apos;s working.
              </h1>
            </div>

            <div className="mt-8 lg:mt-0">
              <FounderVideo />

              <div className="mt-6 flex justify-center lg:justify-start">
                <button
                  type="button"
                  onClick={scrollToWhatsInside}
                  className="btn-outline inline-flex w-full items-center justify-center px-8 py-4 sm:w-auto"
                >
                  See how it works
                </button>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Section 2 — Reframe */}
      <section className="py-16 sm:py-20 md:py-24 lg:py-28">
        <PageContainer>
          <p className="mx-auto max-w-2xl text-center font-body text-base leading-relaxed text-ink sm:text-lg md:text-xl md:leading-relaxed">
            CreatorExec brings your product performance, filming schedule, new product scoring, brand
            deals, and income into one place — so you always know what to film, what&apos;s worth
            testing, and what&apos;s paying off.
          </p>
        </PageContainer>
      </section>

      {/* Section 3 — What's Inside */}
      <section
        ref={whatsInsideRef}
        id="whats-inside"
        className="scroll-mt-6 border-t border-border-warm bg-white py-12 sm:py-16 md:py-20"
        aria-labelledby="whats-inside-heading"
      >
        <PageContainer className="max-w-3xl">
          <h2
            id="whats-inside-heading"
            className="font-display text-center text-2xl font-bold text-ink sm:text-3xl"
          >
            What&apos;s Inside
          </h2>
          <ul className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5">
            {WHATS_INSIDE.map((item, index) => {
              const isLoneLastCard =
                index === WHATS_INSIDE.length - 1 && WHATS_INSIDE.length % 2 !== 0

              return (
              <li
                key={item.label}
                className={`border border-border-warm bg-white p-5 text-left sm:p-6${
                  isLoneLastCard
                    ? ' sm:col-span-2 sm:justify-self-center sm:w-[calc((100%-1.25rem)/2)]'
                    : ''
                }`}
              >
                <p className="font-body text-sm font-semibold text-emerald sm:text-base">
                  {item.label}
                </p>
                <p className="mt-2 font-body text-sm leading-relaxed text-stone sm:text-base">
                  {item.description}
                </p>
              </li>
              )
            })}
          </ul>
        </PageContainer>
      </section>

      {/* Section 4 — Social proof placeholder */}
      <section
        className="border-t border-border-warm py-12 sm:py-16 md:py-20"
        aria-label="Social proof — coming soon"
      >
        <PageContainer>
          <div className="flex min-h-[12rem] items-center justify-center border border-dashed border-terracotta bg-terracotta-tint/50 px-6 py-12 sm:min-h-[14rem] sm:px-10">
            <p className="text-center font-body text-sm text-stone sm:text-base">
              [Testimonials / beta results — TBD]
            </p>
          </div>
        </PageContainer>
      </section>

      {/* Section 5 — Final CTA */}
      <section className="border-t border-border-warm bg-terracotta-tint/30 py-14 sm:py-16 md:py-20">
        <PageContainer>
          <div className="mx-auto max-w-lg text-center">
            <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">
              Everything your business needs, finally in one place.
            </h2>
            <p className="mt-4 font-body text-sm leading-relaxed text-stone sm:text-base">
              Stop juggling spreadsheets, DMs, and guesswork. Upload your data, get your tiers,
              build your schedule, score new products, and track every deal and dollar — all from
              one dashboard.
            </p>
            <div className="mt-8">
              <Link
                to="/signup"
                className="btn-primary inline-flex w-full items-center justify-center px-8 py-4 sm:w-auto"
              >
                Get Started →
              </Link>
              <p className="mt-4 font-body text-sm text-stone">
                Already have an account?{' '}
                <Link to="/login" className="link-elegant font-medium text-ink">
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </PageContainer>
      </section>
    </div>
  )
}

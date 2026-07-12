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
        <PageContainer className="max-w-5xl lg:max-w-7xl">
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
      <section className="border-b border-border-warm bg-terracotta-tint/40 py-12 sm:py-16 md:py-20 lg:py-28">
        <PageContainer className="max-w-6xl lg:max-w-7xl">
          <div className="flex justify-center lg:justify-start">
            <CreatorExecWordmark as="p" variant="light" size="compact" />
          </div>

          <div className="mt-8 lg:mt-14 lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-start lg:gap-x-16 xl:gap-x-20">
            <div className="text-center lg:pt-2 lg:text-left">
              <h1 className="mx-auto max-w-3xl font-display text-[1.625rem] font-bold leading-snug text-ink sm:text-3xl md:text-4xl md:leading-tight lg:mx-0 lg:max-w-none lg:text-[2.5rem] lg:leading-[1.15] xl:text-[2.75rem]">
                You&apos;re running a business across four different tabs, a notes app, and your
                memory. It shouldn&apos;t take that much to know what&apos;s working.
              </h1>

              <div className="mt-8 hidden lg:block">
                <button
                  type="button"
                  onClick={scrollToWhatsInside}
                  className="btn-outline inline-flex items-center justify-center px-8 py-4"
                >
                  See how it works
                </button>
              </div>
            </div>

            <figure className="mx-auto mt-10 w-full max-w-lg sm:max-w-xl lg:mt-6 lg:max-w-[35rem] lg:justify-self-end lg:px-8 lg:py-6">
              <FounderVideo />
              <figcaption className="mt-3 text-center font-body text-xs leading-relaxed text-stone lg:text-left">
                M&apos;Lynn Kohli, Founder
              </figcaption>
            </figure>
          </div>

          <div className="mt-8 flex justify-center lg:hidden">
            <button
              type="button"
              onClick={scrollToWhatsInside}
              className="btn-outline inline-flex w-full max-w-sm items-center justify-center px-8 py-4 sm:w-auto"
            >
              See how it works
            </button>
          </div>
        </PageContainer>
      </section>

      {/* Section 2 — Reframe */}
      <section className="py-16 sm:py-20 md:py-24 lg:py-28">
        <PageContainer className="lg:max-w-7xl">
          <p className="mx-auto max-w-2xl text-center font-body text-base leading-relaxed text-ink sm:text-lg md:text-xl md:leading-relaxed lg:max-w-3xl">
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
        <PageContainer className="max-w-3xl lg:max-w-6xl">
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

      {/* Section 4 — Final CTA */}
      <section className="border-t border-border-warm bg-terracotta-tint/30 py-14 sm:py-16 md:py-20">
        <PageContainer className="lg:max-w-7xl">
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

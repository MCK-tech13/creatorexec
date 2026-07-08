import { useCallback, useRef } from 'react'
import { PageContainer } from '../layout/PageContainer'
import { CreatorExecWordmark } from '../ui/CreatorExecWordmark'

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
  const whatsInsideRef = useRef<HTMLElement>(null)

  const scrollToWhatsInside = useCallback(() => {
    whatsInsideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Section 1 — Hero */}
      <section className="border-b border-border-warm bg-blush-tint/40 py-12 sm:py-16 md:py-20">
        <PageContainer className="max-w-4xl">
          <div className="flex justify-center lg:justify-start">
            <CreatorExecWordmark as="p" variant="light" size="compact" />
          </div>

          <div className="mt-8 lg:mt-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
            <div className="text-center lg:text-left">
              <h1 className="font-display text-[1.625rem] font-bold leading-snug text-ink sm:text-3xl md:text-4xl md:leading-tight lg:text-[2.375rem]">
                You&apos;re one messy spreadsheet away from forgetting which of your 48 products
                actually made you money this month.
              </h1>
            </div>

            <div className="mt-8 lg:mt-0">
              <div
                className="relative aspect-video w-full border border-border-warm bg-white shadow-[0_2px_12px_rgba(26,74,58,0.06)]"
                aria-label="Founder video placeholder"
              >
                <div className="absolute inset-0 flex items-center justify-center px-6">
                  <p className="text-center font-body text-sm text-stone sm:text-base">
                    [Founder video placeholder]
                  </p>
                </div>
              </div>

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
            CreatorExec remembers what&apos;s working, tells you what to film next, and catches brand
            deadlines before they slip through your inbox — so your sales history isn&apos;t scattered
            across three tools and your memory.
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
            {WHATS_INSIDE.map((item) => (
              <li
                key={item.label}
                className="border border-border-warm bg-white p-5 text-left sm:p-6"
              >
                <p className="font-body text-sm font-semibold text-emerald sm:text-base">
                  {item.label}
                </p>
                <p className="mt-2 font-body text-sm leading-relaxed text-stone sm:text-base">
                  {item.description}
                </p>
              </li>
            ))}
          </ul>
        </PageContainer>
      </section>

      {/* Section 4 — Social proof placeholder */}
      <section
        className="border-t border-border-warm py-12 sm:py-16 md:py-20"
        aria-label="Social proof — coming soon"
      >
        <PageContainer>
          <div className="flex min-h-[12rem] items-center justify-center border border-dashed border-blush bg-blush-tint/50 px-6 py-12 sm:min-h-[14rem] sm:px-10">
            <p className="text-center font-body text-sm text-stone sm:text-base">
              [Testimonials / beta results — TBD]
            </p>
          </div>
        </PageContainer>
      </section>

      {/* Section 5 — Final CTA */}
      <section className="border-t border-border-warm bg-blush-tint/30 py-14 sm:py-16 md:py-20">
        <PageContainer>
          <div className="mx-auto max-w-lg text-center">
            <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">
              Your filming plan, finally in one place.
            </h2>
            <p className="mt-4 font-body text-sm leading-relaxed text-stone sm:text-base">
              Stop guessing which products deserve your next video. Upload your report, get your
              tier rankings, and walk away with a sprint schedule built around what&apos;s actually
              selling.
            </p>
            <div className="mt-8">
              <button
                type="button"
                onClick={onContinue}
                className="btn-primary inline-flex w-full items-center justify-center px-8 py-4 sm:w-auto"
              >
                Get Started →
              </button>
            </div>
          </div>
        </PageContainer>
      </section>
    </div>
  )
}

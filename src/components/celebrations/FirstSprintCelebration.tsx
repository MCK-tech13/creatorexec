interface FirstSprintCelebrationProps {
  videosFilmed: number
  productsTested: number
  onContinue: () => void
}

export function FirstSprintCelebration({
  videosFilmed,
  productsTested,
  onContinue,
}: FirstSprintCelebrationProps) {
  const videoLabel = videosFilmed === 1 ? 'video filmed' : 'videos filmed'
  const productLabel = productsTested === 1 ? 'product tested' : 'products tested'

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-ink/25 p-4 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-sprint-celebration-title"
        className="celebration-card-enter w-full max-w-md border border-border-warm bg-cream-warm shadow-[0_20px_60px_rgba(26,26,26,0.12)]"
      >
        <div className="border-b border-emerald/20 bg-terracotta-tint px-6 py-6 sm:px-8 sm:py-7">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-emerald">
            Milestone
          </p>
          <h2
            id="first-sprint-celebration-title"
            className="mt-2 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl"
          >
            You completed your first sprint 🎉
          </h2>
          <p className="mt-3 font-body text-sm leading-relaxed text-stone sm:text-base">
            That&apos;s a real start — you showed up, filmed, and gave your products a fair test.
          </p>
        </div>
        <div className="px-6 py-5 sm:px-8 sm:py-6">
          <p className="font-body text-sm text-ink">
            {videosFilmed} {videoLabel}, {productsTested} {productLabel}.
          </p>
          <button
            type="button"
            onClick={onContinue}
            className="btn-primary mt-5 w-full px-6 py-3 text-sm"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

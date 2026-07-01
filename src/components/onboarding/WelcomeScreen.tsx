import { EditorialMark } from '../ui/EditorialMark'

interface WelcomeScreenProps {
  onContinue: () => void
}

export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
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
            <h2 className="animate-welcome-headline font-display mx-auto max-w-md text-2xl font-bold leading-snug text-ink md:text-3xl">
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
            <p
              className="animate-welcome-fade mx-auto mt-3 max-w-lg font-body text-sm font-normal text-stone"
              style={{ animationDelay: '0.28s' }}
            >
              Takes 30 seconds. Then your schedule&apos;s ready.
            </p>
          </div>

          <div className="animate-welcome-fade mt-14" style={{ animationDelay: '0.35s' }}>
            <button type="button" onClick={onContinue} className="btn-primary w-full py-4">
              Get Started →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { Home } from 'lucide-react'

export function Header({
  mainSection,
  onSectionChange,
  onGoHome,
}: {
  mainSection: 'sprint' | 'retainers' | 'income'
  onSectionChange: (section: 'sprint' | 'retainers' | 'income') => void
  onGoHome: () => void
}) {
  return (
    <header className="border-b border-border-warm bg-white">
      <div className="mx-auto max-w-7xl px-8 py-8 md:py-10">
        <div className="flex items-start justify-between gap-6">
          <div className="inline-block">
            <h1 className="font-display text-5xl font-bold text-ink md:text-6xl lg:text-7xl">
              CreatorExec
            </h1>
            <div className="mt-2 h-px w-[60px] bg-emerald" aria-hidden />
            <p className="label-caps mt-6">Your TikTok Shop Operating System</p>
          </div>
          <button
            type="button"
            onClick={onGoHome}
            className="btn-outline inline-flex shrink-0 items-center gap-2 px-4 py-2.5 font-body text-sm font-medium uppercase tracking-[0.1em] text-emerald"
            aria-label="Home"
          >
            <Home className="h-4 w-4" strokeWidth={2} />
            Home
          </button>
        </div>
      </div>
      <nav
        className="border-t border-border-warm bg-white"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-7xl">
          <button
            type="button"
            onClick={() => onSectionChange('sprint')}
            className={`flex-1 border-b-2 px-6 py-4 font-body text-sm font-medium uppercase tracking-[0.1em] transition ${
              mainSection === 'sprint'
                ? 'border-emerald text-emerald'
                : 'border-transparent text-stone hover:text-ink'
            }`}
          >
            Sprint
          </button>
          <button
            type="button"
            onClick={() => onSectionChange('retainers')}
            className={`flex-1 border-b-2 px-6 py-4 font-body text-sm font-medium uppercase tracking-[0.1em] transition ${
              mainSection === 'retainers'
                ? 'border-emerald text-emerald'
                : 'border-transparent text-stone hover:text-ink'
            }`}
          >
            Retainer Deals
          </button>
          <button
            type="button"
            onClick={() => onSectionChange('income')}
            className={`flex-1 border-b-2 px-6 py-4 font-body text-sm font-medium uppercase tracking-[0.1em] transition ${
              mainSection === 'income'
                ? 'border-emerald text-emerald'
                : 'border-transparent text-stone hover:text-ink'
            }`}
          >
            Income Tracker
          </button>
        </div>
      </nav>
    </header>
  )
}

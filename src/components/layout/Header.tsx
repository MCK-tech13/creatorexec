import { Home } from 'lucide-react'
import { CreatorExecWordmark } from '../ui/CreatorExecWordmark'
import type { MainSection } from '../../types'

export function Header({
  mainSection,
  onSectionChange,
  onGoHome,
}: {
  mainSection: MainSection
  onSectionChange: (section: MainSection) => void
  onGoHome: () => void
}) {
  return (
    <header className="border-b border-border-warm bg-white">
      <div className="mx-auto max-w-7xl px-5 py-3 sm:px-8 sm:py-6 md:py-8">
        <div className="flex items-center justify-between gap-3 sm:items-start sm:gap-6">
          <div className="min-w-0">
            <CreatorExecWordmark as="h1" variant="light" size="header" />
            <div className="mt-1.5 h-px w-10 bg-emerald sm:mt-2 sm:w-[60px]" aria-hidden />
            <p className="label-caps mt-2 hidden sm:block md:mt-4">
              Your TikTok Shop Operating System
            </p>
          </div>
          <button
            type="button"
            onClick={onGoHome}
            className="btn-outline inline-flex shrink-0 items-center gap-1.5 px-2.5 py-2 font-body text-xs font-medium uppercase tracking-[0.08em] text-emerald sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm sm:tracking-[0.1em]"
            aria-label="Home"
          >
            <Home className="h-4 w-4" strokeWidth={2} />
            <span className="hidden sm:inline">Home</span>
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
            className={`flex-1 border-b-2 px-1 py-2.5 font-body text-[10px] font-medium whitespace-nowrap uppercase tracking-[0.03em] transition sm:px-6 sm:py-4 sm:text-sm sm:tracking-[0.1em] ${
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
            className={`flex-1 border-b-2 px-1 py-2.5 font-body text-[10px] font-medium whitespace-nowrap uppercase tracking-[0.03em] transition sm:px-6 sm:py-4 sm:text-sm sm:tracking-[0.1em] ${
              mainSection === 'retainers'
                ? 'border-emerald text-emerald'
                : 'border-transparent text-stone hover:text-ink'
            }`}
          >
            <span className="sm:hidden">Retainers</span>
            <span className="hidden sm:inline">Retainer Deals</span>
          </button>
          <button
            type="button"
            onClick={() => onSectionChange('income')}
            className={`flex-1 border-b-2 px-1 py-2.5 font-body text-[10px] font-medium whitespace-nowrap uppercase tracking-[0.03em] transition sm:px-6 sm:py-4 sm:text-sm sm:tracking-[0.1em] ${
              mainSection === 'income'
                ? 'border-emerald text-emerald'
                : 'border-transparent text-stone hover:text-ink'
            }`}
          >
            <span className="sm:hidden">Income</span>
            <span className="hidden sm:inline">Income Tracker</span>
          </button>
          <button
            type="button"
            onClick={() => onSectionChange('product-scout')}
            className={`flex-1 border-b-2 px-1 py-2.5 font-body text-[10px] font-medium whitespace-nowrap uppercase tracking-[0.03em] transition sm:px-6 sm:py-4 sm:text-sm sm:tracking-[0.1em] ${
              mainSection === 'product-scout'
                ? 'border-emerald text-emerald'
                : 'border-transparent text-stone hover:text-ink'
            }`}
          >
            <span className="sm:hidden">Scout</span>
            <span className="hidden sm:inline">Product Scout</span>
          </button>
        </div>
      </nav>
    </header>
  )
}

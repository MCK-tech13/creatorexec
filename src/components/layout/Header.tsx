export function Header({
  mainSection,
  onSectionChange,
}: {
  mainSection: 'sprint' | 'retainers'
  onSectionChange: (section: 'sprint' | 'retainers') => void
}) {
  return (
    <header className="border-b border-border-warm bg-white">
      <div className="mx-auto max-w-7xl px-8 py-8 md:py-10">
        <div className="inline-block">
          <h1 className="font-display text-5xl font-bold text-ink md:text-6xl lg:text-7xl">
            CreatorExec
          </h1>
          <div className="mt-2 h-px w-[60px] bg-emerald" aria-hidden />
          <p className="label-caps mt-6">Your TikTok Shop Operating System</p>
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
        </div>
      </nav>
    </header>
  )
}

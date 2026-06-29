interface AppFooterProps {
  onResetOnboarding: () => void
}

export function AppFooter({ onResetOnboarding }: AppFooterProps) {
  return (
    <footer className="border-t border-border-warm bg-cream-card">
      <div className="mx-auto max-w-7xl px-8 py-6 text-center">
        <button
          type="button"
          onClick={onResetOnboarding}
          className="font-sans text-xs text-stone transition hover:text-emerald"
        >
          Reset onboarding
        </button>
      </div>
    </footer>
  )
}

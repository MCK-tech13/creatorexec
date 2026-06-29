interface AppFooterProps {
  onResetOnboarding: () => void
}

export function AppFooter({ onResetOnboarding }: AppFooterProps) {
  return (
    <footer className="border-t border-border-warm bg-white">
      <div className="mx-auto max-w-7xl px-8 py-8 text-center">
        <button
          type="button"
          onClick={onResetOnboarding}
          className="link-elegant font-body text-xs uppercase tracking-[0.14em] text-stone"
        >
          Reset onboarding
        </button>
      </div>
    </footer>
  )
}

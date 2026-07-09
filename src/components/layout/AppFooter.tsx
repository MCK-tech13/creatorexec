interface AppFooterProps {
  onResetOnboarding: () => void
}

export function AppFooter({ onResetOnboarding }: AppFooterProps) {
  return (
    <footer className="border-t border-border-warm bg-white">
      <div className="mx-auto max-w-7xl px-5 py-6 text-center sm:px-8 sm:py-8">
        <button
          type="button"
          onClick={onResetOnboarding}
          className="link-elegant font-body text-xs uppercase tracking-[0.14em] text-stone"
        >
          Restart Sprint Setup
        </button>
      </div>
    </footer>
  )
}

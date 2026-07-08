interface AppFooterProps {
  sprintSetupComplete: boolean
  onStartSprintSetup: () => void
  onResetOnboarding: () => void
}

export function AppFooter({
  sprintSetupComplete,
  onStartSprintSetup,
  onResetOnboarding,
}: AppFooterProps) {
  return (
    <footer className="border-t border-border-warm bg-white">
      <div className="mx-auto max-w-7xl px-5 py-6 text-center sm:px-8 sm:py-8">
        <button
          type="button"
          onClick={sprintSetupComplete ? onResetOnboarding : onStartSprintSetup}
          className="link-elegant font-body text-xs uppercase tracking-[0.14em] text-stone"
        >
          {sprintSetupComplete ? 'Restart Sprint Setup' : 'Start Sprint Setup'}
        </button>
      </div>
    </footer>
  )
}

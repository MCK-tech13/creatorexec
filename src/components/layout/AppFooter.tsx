import { SiteFooter } from './SiteFooter'

interface AppFooterProps {
  onResetOnboarding: () => void
  onResetCurrentSprint?: () => void
  canResetCurrentSprint?: boolean
}

export function AppFooter({
  onResetOnboarding,
  onResetCurrentSprint,
  canResetCurrentSprint = false,
}: AppFooterProps) {
  return (
    <SiteFooter
      variant="app"
      onResetOnboarding={onResetOnboarding}
      onResetCurrentSprint={onResetCurrentSprint}
      canResetCurrentSprint={canResetCurrentSprint}
    />
  )
}

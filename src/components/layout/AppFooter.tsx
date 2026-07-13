import { SiteFooter } from './SiteFooter'

interface AppFooterProps {
  onResetOnboarding: () => void
}

export function AppFooter({ onResetOnboarding }: AppFooterProps) {
  return <SiteFooter variant="app" onResetOnboarding={onResetOnboarding} />
}

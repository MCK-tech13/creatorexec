import type { ReactNode } from 'react'
import type { AppStage, MainSection } from '../../types'
import { BillingBanner } from '../billing/BillingBanner'
import { AppFooter } from './AppFooter'
import { Header } from './Header'
import { PageContainer, type PageContainerVariant } from './PageContainer'

const STEPS: { id: AppStage; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'dashboard', label: 'Analyze' },
  { id: 'config', label: 'Configure' },
  { id: 'schedule', label: 'Schedule' },
]

interface AppShellProps {
  stage: AppStage
  mainSection: MainSection
  onSectionChange: (section: MainSection) => void
  onGoHome: () => void
  onSignOut?: () => void
  userEmail?: string | null
  children: ReactNode
  onResetOnboarding: () => void
  sprintSetupComplete: boolean
  contentWidth?: PageContainerVariant
  showSprintStepper?: boolean
}

function stageIndex(stage: AppStage): number {
  if (stage === 'sample' || stage === 'momentum') return 0
  return STEPS.findIndex((s) => s.id === stage)
}

export function AppShell({
  stage,
  mainSection,
  onSectionChange,
  onGoHome,
  onSignOut,
  userEmail,
  children,
  onResetOnboarding,
  sprintSetupComplete,
  contentWidth = 'narrow',
  showSprintStepper = false,
}: AppShellProps) {
  const current = stageIndex(stage)
  const isSprintUpload = mainSection === 'sprint' && stage === 'upload'
  const showStepper = showSprintStepper

  return (
    <div className="flex min-h-screen flex-col bg-cream-warm">
      <Header
        mainSection={mainSection}
        onSectionChange={onSectionChange}
        onGoHome={onGoHome}
        onSignOut={onSignOut}
        userEmail={userEmail}
      />
      <BillingBanner />
      {showStepper && (
      <div className="border-b border-border-warm bg-white">
        <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex items-center">
            {STEPS.map((step, i) => {
              const isActive = i === current
              const isComplete = i < current
              const isLast = i === STEPS.length - 1

              return (
                <div key={step.id} className="flex flex-1 items-center last:flex-none">
                  <div className="flex shrink-0 flex-col items-center gap-3">
                    <span
                      className={`font-body text-sm tabular-nums ${
                        isActive
                          ? 'font-bold text-emerald'
                          : isComplete
                            ? 'font-medium text-ink'
                            : 'font-normal text-grey-light'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={`font-body text-[9px] uppercase tracking-[0.14em] sm:text-[10px] sm:tracking-[0.16em] ${
                        isActive ? 'font-semibold text-ink' : 'text-stone'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div className="mx-6 mb-5 h-px flex-1 bg-border-warm" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      )}
      <main className={`flex-1 bg-cream-warm ${isSprintUpload ? '' : 'py-10 sm:py-16'}`}>
        <PageContainer variant={contentWidth}>{children}</PageContainer>
      </main>
      {sprintSetupComplete && <AppFooter onResetOnboarding={onResetOnboarding} />}
    </div>
  )
}

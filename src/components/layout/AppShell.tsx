import type { ReactNode } from 'react'
import type { AppStage, MainSection } from '../../types'
import { AppFooter } from './AppFooter'
import { Header } from './Header'

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
  children: ReactNode
  onResetOnboarding: () => void
}

function stageIndex(stage: AppStage): number {
  if (stage === 'sample' || stage === 'momentum') return 0
  return STEPS.findIndex((s) => s.id === stage)
}

export function AppShell({
  stage,
  mainSection,
  onSectionChange,
  children,
  onResetOnboarding,
}: AppShellProps) {
  const current = stageIndex(stage)
  const isUpload = stage === 'upload'
  const showStepper = mainSection === 'sprint'

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header mainSection={mainSection} onSectionChange={onSectionChange} />
      {showStepper && (
      <div className="border-b border-border-warm bg-white">
        <div className="mx-auto max-w-7xl px-8 py-8">
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
                      className={`font-body text-[10px] uppercase tracking-[0.16em] ${
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
      <main
        className={`mx-auto w-full flex-1 bg-white ${
          isUpload && mainSection === 'sprint'
            ? 'max-w-none px-0 py-0'
            : 'max-w-7xl px-8 py-16'
        }`}
      >
        {children}
      </main>
      <AppFooter onResetOnboarding={onResetOnboarding} />
    </div>
  )
}

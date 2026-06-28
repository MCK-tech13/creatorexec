import type { ReactNode } from 'react'
import type { AppStage } from '../../types'
import { Header } from './Header'

const STEPS: { id: AppStage; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'dashboard', label: 'Analyze' },
  { id: 'config', label: 'Configure' },
  { id: 'schedule', label: 'Schedule' },
]

interface AppShellProps {
  stage: AppStage
  children: ReactNode
}

function stageIndex(stage: AppStage): number {
  return STEPS.findIndex((s) => s.id === stage)
}

export function AppShell({ stage, children }: AppShellProps) {
  const current = stageIndex(stage)
  const isUpload = stage === 'upload'

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Header />
      <div className="border-b border-border-warm bg-cream-card">
        <div className="mx-auto max-w-7xl px-8 py-5">
          <div className="flex items-center">
            {STEPS.map((step, i) => {
              const isActive = i === current
              const isComplete = i < current
              const isLast = i === STEPS.length - 1

              return (
                <div key={step.id} className="flex flex-1 items-center last:flex-none">
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full font-sans text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-emerald text-white'
                          : isComplete
                            ? 'bg-emerald-muted text-emerald'
                            : 'bg-cream text-grey ring-1 ring-border-warm'
                      }`}
                    >
                      {i + 1}
                    </div>
                    <span
                      className={`font-sans text-xs font-medium ${
                        isActive
                          ? 'text-emerald'
                          : isComplete
                            ? 'text-ink'
                            : 'text-grey'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div
                      className={`mx-4 mb-6 h-px flex-1 ${
                        isComplete ? 'bg-emerald' : 'bg-border-warm'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <main
        className={`mx-auto w-full flex-1 ${
          isUpload ? 'max-w-none px-0 py-0' : 'max-w-7xl px-8 py-12'
        }`}
      >
        {children}
      </main>
    </div>
  )
}

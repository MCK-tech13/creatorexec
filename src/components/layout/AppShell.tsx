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

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Header />
      <div className="border-b border-border-warm bg-cream-card">
        <div className="mx-auto flex max-w-7xl gap-2 px-6 py-3">
          {STEPS.map((step, i) => {
            const isActive = i === current
            const isComplete = i < current
            return (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full font-sans text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-emerald text-cream'
                      : isComplete
                        ? 'bg-emerald/15 text-emerald'
                        : 'bg-cream text-stone ring-1 ring-border-warm'
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`font-sans text-sm ${
                    isActive
                      ? 'font-semibold text-emerald'
                      : isComplete
                        ? 'font-medium text-emerald-hover'
                        : 'text-stone'
                  }`}
                >
                  {step.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className="mx-2 hidden h-px w-8 bg-border-warm sm:block" />
                )}
              </div>
            )
          })}
        </div>
      </div>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
    </div>
  )
}

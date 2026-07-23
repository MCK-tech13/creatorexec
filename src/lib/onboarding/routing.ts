import type { AppStage } from '../../types'
import type { MonthlyCommissionLevel } from '../../types/onboarding'
import { loadOnboardingProfile } from './storage'
import { hasSeenSprintEntry } from './sprintEntryStorage'

/** Maps Q1 (monthly commission) to the Sprint entry screen after onboarding. */
export function stageFromMonthlyCommission(level: MonthlyCommissionLevel): AppStage {
  switch (level) {
    case 'just_starting':
      return 'sample'
    case 'growing':
    case 'established':
      return 'upload'
  }
}

export type UploadLandingMode = 'routed' | 'empty'

/** Sprint landing view for first load or Home — view state only, no data cleared. */
export function resolveHomeView(options?: {
  hasProductData?: boolean
  hasActiveRetainers?: boolean
}): { stage: AppStage; uploadLandingMode: UploadLandingMode } {
  const { hasProductData = false, hasActiveRetainers = false } = options ?? {}

  if (hasProductData) {
    return { stage: 'dashboard', uploadLandingMode: 'routed' }
  }
  if (hasActiveRetainers) {
    return { stage: 'upload', uploadLandingMode: 'routed' }
  }

  const profile = loadOnboardingProfile()
  if (!profile) {
    return { stage: 'upload', uploadLandingMode: 'routed' }
  }
  if (!hasSeenSprintEntry()) {
    return {
      stage: stageFromMonthlyCommission(profile.answers.monthlyCommission),
      uploadLandingMode: 'routed',
    }
  }
  return { stage: 'upload', uploadLandingMode: 'empty' }
}

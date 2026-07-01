import type { AppStage } from '../../types'
import type { MonthlyCommissionLevel } from '../../types/onboarding'

/** Maps Q1 (monthly commission) to the Sprint entry screen after onboarding. */
export function stageFromMonthlyCommission(level: MonthlyCommissionLevel): AppStage {
  switch (level) {
    case 'just_starting':
      return 'sample'
    case 'growing':
      return 'momentum'
    case 'established':
      return 'upload'
  }
}

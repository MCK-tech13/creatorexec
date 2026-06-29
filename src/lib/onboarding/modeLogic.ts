import type {
  FilmingApproach,
  MonthlyCommissionLevel,
  OnboardingAnswers,
  UserMode,
} from '../../types/onboarding'

export function assignUserMode(
  monthlyCommission: MonthlyCommissionLevel,
  filmingApproach: FilmingApproach,
): UserMode {
  if (monthlyCommission === 'just_starting' || filmingApproach === 'whatever_samples') {
    return 'beginner'
  }
  if (monthlyCommission === 'established' && filmingApproach === 'solid_system') {
    return 'advanced'
  }
  return 'beginner'
}

export function buildOnboardingAnswers(
  monthlyCommission: MonthlyCommissionLevel,
  videosPerDay: number,
  filmingApproach: FilmingApproach,
): OnboardingAnswers {
  return { monthlyCommission, videosPerDay, filmingApproach }
}

export function resolveModeFromAnswers(answers: OnboardingAnswers): UserMode {
  return assignUserMode(answers.monthlyCommission, answers.filmingApproach)
}

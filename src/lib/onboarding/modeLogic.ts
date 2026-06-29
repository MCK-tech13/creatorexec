import type {
  AffiliateExperience,
  FilmingApproach,
  OnboardingAnswers,
  UserMode,
} from '../../types/onboarding'

export function assignUserMode(
  experience: AffiliateExperience,
  filmingApproach: FilmingApproach,
): UserMode {
  if (experience === 'just_starting' || filmingApproach === 'whatever_samples') {
    return 'beginner'
  }
  if (experience === 'established' && filmingApproach === 'solid_system') {
    return 'advanced'
  }
  return 'beginner'
}

export function buildOnboardingAnswers(
  experience: AffiliateExperience,
  videosPerDay: number,
  filmingApproach: FilmingApproach,
): OnboardingAnswers {
  return { experience, videosPerDay, filmingApproach }
}

export function resolveModeFromAnswers(answers: OnboardingAnswers): UserMode {
  return assignUserMode(answers.experience, answers.filmingApproach)
}

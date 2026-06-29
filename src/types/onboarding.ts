export type UserMode = 'beginner' | 'advanced'

export type AffiliateExperience = 'just_starting' | 'growing' | 'established'

export type FilmingApproach = 'whatever_samples' | 'rough_system' | 'solid_system'

export interface OnboardingAnswers {
  experience: AffiliateExperience
  videosPerDay: number
  filmingApproach: FilmingApproach
}

export interface OnboardingProfile {
  completed: true
  mode: UserMode
  videosPerDay: number
  answers: OnboardingAnswers
}

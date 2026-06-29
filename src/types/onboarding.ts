export type UserMode = 'beginner' | 'advanced'

/** Q1: monthly TikTok Shop commission tier */
export type MonthlyCommissionLevel = 'just_starting' | 'growing' | 'established'

export type FilmingApproach = 'whatever_samples' | 'rough_system' | 'solid_system'

export interface OnboardingAnswers {
  monthlyCommission: MonthlyCommissionLevel
  videosPerDay: number
  filmingApproach: FilmingApproach
}

export interface OnboardingProfile {
  completed: true
  mode: UserMode
  videosPerDay: number
  answers: OnboardingAnswers
}

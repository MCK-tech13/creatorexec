/** Legacy localStorage keys migrated to Supabase on first login per user. */
export const LOCAL_STORAGE_KEYS = {
  trialProgress: 'creatorexec-trial-progress',
  brandDeals: 'creatorexec-brand-deals',
  incomeTracker: 'creatorexec-income-tracker',
  productScout: 'creatorexec-product-scout',
  onboarding: 'creatorexec-onboarding',
  sprintEntrySeen: 'creatorexec-sprint-entry-seen',
  welcomeSeen: 'creatorexec-welcome-seen',
  sprintStart: 'creatorexec-sprint-start',
  sprintPrevious: 'creatorexec-sprint-previous',
} as const

export function migrationFlagKey(userId: string): string {
  return `creatorexec-supabase-migrated-${userId}`
}

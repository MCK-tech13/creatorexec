import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { UserDataSnapshot } from './dataStore'
import {
  brandDealFromRow,
  currentSprintFromRow,
  incomeTrackerFromRows,
  onboardingProfileFromRow,
  parseSprintSnapshot,
  productScoutFromRow,
  trialProgressFromRows,
} from './mappers'
import { fetchSprintHistory } from './sprintHistory'

type Client = SupabaseClient<Database>

export async function fetchUserDataFromSupabase(client: Client, userId: string): Promise<UserDataSnapshot> {
  const [
    trialResult,
    dealsResult,
    incomeResult,
    scoutResult,
    onboardingResult,
    currentSprintResult,
    sprintHistory,
  ] = await Promise.all([
    client.from('trial_progress').select('*').eq('user_id', userId),
    client.from('retainer_deals').select('*').eq('user_id', userId).order('created_at'),
    client.from('income_entries').select('*').eq('user_id', userId),
    client.from('product_scout_list').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    client.from('onboarding_state').select('*').eq('user_id', userId).maybeSingle(),
    client.from('current_sprint_state').select('*').eq('user_id', userId).maybeSingle(),
    fetchSprintHistory(client, userId),
  ])

  if (trialResult.error) throw trialResult.error
  if (dealsResult.error) throw dealsResult.error
  if (incomeResult.error) throw incomeResult.error
  if (scoutResult.error) throw scoutResult.error
  if (onboardingResult.error) throw onboardingResult.error
  if (currentSprintResult.error) throw currentSprintResult.error

  const onboarding = onboardingResult.data

  return {
    trialProgress: trialProgressFromRows(trialResult.data ?? []),
    brandDeals: (dealsResult.data ?? []).map(brandDealFromRow),
    incomeTracker: incomeTrackerFromRows(incomeResult.data ?? []),
    productScoutEntries: (scoutResult.data ?? []).map(productScoutFromRow),
    onboardingProfile: onboarding ? onboardingProfileFromRow(onboarding) : null,
    sprintEntrySeen: onboarding?.sprint_entry_seen ?? false,
    welcomeSeen: onboarding?.welcome_seen ?? false,
    sprintStartSnapshot: parseSprintSnapshot(onboarding?.sprint_start_snapshot),
    sprintPreviousSnapshot: parseSprintSnapshot(onboarding?.sprint_previous_snapshot),
    currentSprintState: currentSprintResult.data
      ? currentSprintFromRow(currentSprintResult.data)
      : null,
    sprintHistory,
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { UserDataSnapshot } from './dataStore'
import {
  brandDealFromRow,
  catalogProductFromRow,
  currentSprintFromRow,
  incomeTrackerFromRows,
  onboardingProfileFromRow,
  parseSprintSnapshot,
  productScoutFromRow,
  trialProgressFromRows,
  userEngagementFromRow,
} from './mappers'
import { fetchSprintHistory } from './sprintHistory'
import { emptyUserEngagement } from '../../types/userEngagement'

type Client = SupabaseClient<Database>

export async function fetchUserDataFromSupabase(client: Client, userId: string): Promise<UserDataSnapshot> {
  const [
    trialResult,
    dealsResult,
    incomeResult,
    scoutResult,
    catalogResult,
    onboardingResult,
    currentSprintResult,
    sprintHistory,
    engagementResult,
  ] = await Promise.all([
    client.from('trial_progress').select('*').eq('user_id', userId),
    client.from('retainer_deals').select('*').eq('user_id', userId).order('created_at'),
    client.from('income_entries').select('*').eq('user_id', userId),
    client.from('product_scout_list').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    client.from('user_products').select('*').eq('user_id', userId).order('display_name'),
    client.from('onboarding_state').select('*').eq('user_id', userId).maybeSingle(),
    client.from('current_sprint_state').select('*').eq('user_id', userId).maybeSingle(),
    fetchSprintHistory(client, userId),
    client.from('user_engagement').select('*').eq('user_id', userId).maybeSingle(),
  ])

  if (trialResult.error) throw trialResult.error
  if (dealsResult.error) throw dealsResult.error
  if (incomeResult.error) throw incomeResult.error
  if (scoutResult.error) throw scoutResult.error
  // Stage 1 rollout: allow empty catalog if migration not applied yet.
  if (catalogResult.error) {
    const message = catalogResult.error.message?.toLowerCase() ?? ''
    const missingTable =
      catalogResult.error.code === '42P01' ||
      catalogResult.error.code === 'PGRST205' ||
      message.includes('user_products') ||
      message.includes('does not exist') ||
      message.includes('schema cache')
    if (!missingTable) throw catalogResult.error
    console.warn(
      'user_products unavailable — apply migration 20260720000000_user_products.sql',
      catalogResult.error.message,
    )
  }
  if (onboardingResult.error) throw onboardingResult.error
  if (currentSprintResult.error) throw currentSprintResult.error
  if (engagementResult.error) throw engagementResult.error

  const onboarding = onboardingResult.data

  return {
    trialProgress: trialProgressFromRows(trialResult.data ?? []),
    brandDeals: (dealsResult.data ?? []).map(brandDealFromRow),
    incomeTracker: incomeTrackerFromRows(incomeResult.data ?? []),
    productScoutEntries: (scoutResult.data ?? []).map(productScoutFromRow),
    productCatalog: catalogResult.error
      ? []
      : (catalogResult.data ?? []).map(catalogProductFromRow),
    onboardingProfile: onboarding ? onboardingProfileFromRow(onboarding) : null,
    sprintEntrySeen: onboarding?.sprint_entry_seen ?? false,
    welcomeSeen: onboarding?.welcome_seen ?? false,
    sprintStartSnapshot: parseSprintSnapshot(onboarding?.sprint_start_snapshot),
    sprintPreviousSnapshot: parseSprintSnapshot(onboarding?.sprint_previous_snapshot),
    currentSprintState: currentSprintResult.data
      ? currentSprintFromRow(currentSprintResult.data)
      : null,
    sprintHistory,
    userEngagement: engagementResult.data
      ? userEngagementFromRow(engagementResult.data)
      : emptyUserEngagement(),
  }
}

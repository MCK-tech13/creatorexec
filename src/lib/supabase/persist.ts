import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { UserDataSnapshot } from './dataStore'
import {
  brandDealToRow,
  incomeEntryToRow,
  onboardingProfileToRow,
  productScoutToRow,
  trialProgressToRows,
} from './mappers'

type Client = SupabaseClient<Database>

export async function persistTrialProgress(
  client: Client,
  userId: string,
  store: UserDataSnapshot['trialProgress'],
): Promise<void> {
  const rows = trialProgressToRows(userId, store)
  const { data: existing, error: selectError } = await client
    .from('trial_progress')
    .select('product_id')
    .eq('user_id', userId)

  if (selectError) throw selectError

  const nextIds = new Set(rows.map((row) => row.product_id))
  const toDelete = (existing ?? [])
    .map((row) => row.product_id)
    .filter((productId) => !nextIds.has(productId))

  if (toDelete.length > 0) {
    const { error } = await client
      .from('trial_progress')
      .delete()
      .eq('user_id', userId)
      .in('product_id', toDelete)
    if (error) throw error
  }

  if (rows.length === 0) return

  const { error } = await client.from('trial_progress').upsert(rows, {
    onConflict: 'user_id,product_id',
  })
  if (error) throw error
}

export async function persistBrandDeals(
  client: Client,
  userId: string,
  deals: UserDataSnapshot['brandDeals'],
): Promise<void> {
  const rows = deals.map((deal) => brandDealToRow(userId, deal))
  const nextIds = new Set(rows.map((row) => row.id).filter(Boolean) as string[])

  const { data: existing, error: selectError } = await client
    .from('retainer_deals')
    .select('id')
    .eq('user_id', userId)

  if (selectError) throw selectError

  const toDelete = (existing ?? [])
    .map((row) => row.id)
    .filter((id) => !nextIds.has(id))

  if (toDelete.length > 0) {
    const { error } = await client.from('retainer_deals').delete().in('id', toDelete)
    if (error) throw error
  }

  if (rows.length === 0) return

  const { error } = await client.from('retainer_deals').upsert(rows)
  if (error) throw error
}

export async function persistIncomeTracker(
  client: Client,
  userId: string,
  store: UserDataSnapshot['incomeTracker'],
): Promise<void> {
  const rows = store.map((entry) => incomeEntryToRow(userId, entry))
  const nextIds = new Set(rows.map((row) => row.id).filter(Boolean) as string[])

  const { data: existing, error: selectError } = await client
    .from('income_entries')
    .select('id')
    .eq('user_id', userId)

  if (selectError) throw selectError

  const toDelete = (existing ?? [])
    .map((row) => row.id)
    .filter((id) => !nextIds.has(id))

  if (toDelete.length > 0) {
    const { error } = await client.from('income_entries').delete().in('id', toDelete)
    if (error) throw error
  }

  if (rows.length === 0) return

  const { error } = await client.from('income_entries').upsert(rows)
  if (error) throw error
}

export async function persistProductScoutEntries(
  client: Client,
  userId: string,
  entries: UserDataSnapshot['productScoutEntries'],
): Promise<void> {
  const rows = entries.map((entry) => productScoutToRow(userId, entry))
  const nextIds = new Set(rows.map((row) => row.id).filter(Boolean) as string[])

  const { data: existing, error: selectError } = await client
    .from('product_scout_list')
    .select('id')
    .eq('user_id', userId)

  if (selectError) throw selectError

  const toDelete = (existing ?? [])
    .map((row) => row.id)
    .filter((id) => !nextIds.has(id))

  if (toDelete.length > 0) {
    const { error } = await client.from('product_scout_list').delete().in('id', toDelete)
    if (error) throw error
  }

  if (rows.length === 0) return

  const { error } = await client.from('product_scout_list').upsert(rows)
  if (error) throw error
}

export async function persistOnboardingState(
  client: Client,
  userId: string,
  snapshot: Pick<
    UserDataSnapshot,
    | 'onboardingProfile'
    | 'sprintEntrySeen'
    | 'welcomeSeen'
    | 'sprintStartSnapshot'
    | 'sprintPreviousSnapshot'
  >,
): Promise<void> {
  const row = onboardingProfileToRow(userId, snapshot.onboardingProfile, {
    welcomeSeen: snapshot.welcomeSeen,
    sprintEntrySeen: snapshot.sprintEntrySeen,
    sprintStartSnapshot: snapshot.sprintStartSnapshot,
    sprintPreviousSnapshot: snapshot.sprintPreviousSnapshot,
  })

  const { error } = await client.from('onboarding_state').upsert(row)
  if (error) throw error
}

export async function clearOnboardingState(client: Client, userId: string): Promise<void> {
  const { error } = await client.from('onboarding_state').delete().eq('user_id', userId)
  if (error) throw error
}

export async function clearTrialProgress(client: Client, userId: string): Promise<void> {
  const { error } = await client.from('trial_progress').delete().eq('user_id', userId)
  if (error) throw error
}

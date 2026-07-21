import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { UserDataSnapshot } from './dataStore'
import {
  brandDealToRow,
  catalogProductToRow,
  currentSprintToRow,
  incomeEntryToRow,
  onboardingProfileToRow,
  productScoutToRow,
  trialProgressToRows,
  userEngagementToRow,
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

function throwPersistError(action: string, error: { message: string; code?: string; details?: string; hint?: string }): never {
  const parts = [
    `product_scout_list ${action} failed: ${error.message}`,
    error.code ? `code=${error.code}` : null,
    error.details ? `details=${error.details}` : null,
    error.hint ? `hint=${error.hint}` : null,
  ].filter(Boolean)
  throw new Error(parts.join(' | '))
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

  if (selectError) throwPersistError('select', selectError)

  const toDelete = (existing ?? [])
    .map((row) => row.id)
    .filter((id) => !nextIds.has(id))

  if (toDelete.length > 0) {
    const { error } = await client.from('product_scout_list').delete().in('id', toDelete)
    if (error) throwPersistError('delete', error)
  }

  if (rows.length === 0) return

  const { error } = await client.from('product_scout_list').upsert(rows)
  if (error) {
    // Batch upsert is atomic — one bad sibling row blocks every product including
    // Hadley. Retry per-row so we persist good rows and surface the real offender.
    const failures: string[] = []
    for (const row of rows) {
      const { error: rowError } = await client.from('product_scout_list').upsert(row)
      if (rowError) {
        failures.push(
          `${row.product_name ?? row.id}: ${rowError.message}${rowError.code ? ` (${rowError.code})` : ''}`,
        )
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `product_scout_list upsert failed: ${error.message}${error.code ? ` | code=${error.code}` : ''}. Per-row: ${failures.join('; ')}`,
      )
    }
  }
}

/**
 * Upsert-only durable catalog write.
 *
 * Intentionally does NOT delete orphans / wipe on empty. Start Over and other
 * sprint resets can leave the in-memory catalog momentarily empty (or flush a
 * stale empty snapshot); replace-all deletes would destroy preserved catalog
 * rows. Explicit wipe belongs in clearProductCatalogRows (onboarding reset).
 */
export async function persistProductCatalog(
  client: Client,
  userId: string,
  products: UserDataSnapshot['productCatalog'],
): Promise<void> {
  if (products.length === 0) return

  const rows = products.map((product) => catalogProductToRow(userId, product))
  const { error } = await client.from('user_products').upsert(rows)
  if (error) throw error
}

/** Full catalog wipe — onboarding reset only, never Start Over / sprint reset. */
export async function clearProductCatalogRows(client: Client, userId: string): Promise<void> {
  const { error } = await client.from('user_products').delete().eq('user_id', userId)
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

export async function persistCurrentSprintState(
  client: Client,
  userId: string,
  state: NonNullable<UserDataSnapshot['currentSprintState']>,
): Promise<void> {
  const row = currentSprintToRow(userId, state)
  const { error } = await client.from('current_sprint_state').upsert(row)
  if (error) throw error
}

export async function clearCurrentSprintStateRow(client: Client, userId: string): Promise<void> {
  const { error } = await client.from('current_sprint_state').delete().eq('user_id', userId)
  if (error) throw error
}

export async function persistUserEngagement(
  client: Client,
  userId: string,
  state: UserDataSnapshot['userEngagement'],
): Promise<void> {
  const row = userEngagementToRow(userId, state)
  const { error } = await client.from('user_engagement').upsert(row)
  if (error) throw error
}

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SprintReview, SprintSnapshot } from '../../types/sprintReview'
import { parseSprintSnapshot } from './mappers'
import type { Database, Json } from './database.types'

type Client = SupabaseClient<Database>

export interface SprintHistoryRecord {
  id: string
  endedAt: string
  endSnapshot: SprintSnapshot
}

export const SPRINT_HISTORY_FETCH_LIMIT = 4

function asJson<T>(value: T): Json {
  return value as unknown as Json
}

export async function insertSprintHistoryRecord(
  client: Client,
  userId: string,
  sprintStart: SprintSnapshot | null,
  sprintEnd: SprintSnapshot,
  review: SprintReview,
): Promise<void> {
  const { error } = await client.from('sprint_history').insert({
    user_id: userId,
    started_at: sprintStart?.savedAt ?? null,
    ended_at: sprintEnd.savedAt,
    file_name: sprintEnd.fileName,
    schedule_mode: sprintEnd.scheduleMode,
    videos_per_day: sprintEnd.config.videosPerDay,
    sprint_days: sprintEnd.config.sprintDays,
    start_total_commission: sprintStart?.totalCommission ?? null,
    end_total_commission: sprintEnd.totalCommission,
    commission_delta: review.commission.delta,
    commission_percent_change: review.commission.percentChange,
    start_snapshot: sprintStart ? asJson(sprintStart) : null,
    end_snapshot: asJson(sprintEnd),
    tier_movements: asJson(review.tierMovements),
    trial_completions: asJson(review.trialCompletions),
    top_performer: review.topPerformer ? asJson(review.topPerformer) : null,
    trials_in_progress: review.trialsInProgress,
  })

  if (error) throw error
}

export async function fetchSprintHistory(
  client: Client,
  userId: string,
  limit = SPRINT_HISTORY_FETCH_LIMIT,
): Promise<SprintHistoryRecord[]> {
  const { data, error } = await client
    .from('sprint_history')
    .select('id, ended_at, end_snapshot')
    .eq('user_id', userId)
    .order('ended_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const records: SprintHistoryRecord[] = []
  for (const row of data ?? []) {
    const endSnapshot = parseSprintSnapshot(row.end_snapshot)
    if (!endSnapshot) continue
    records.push({
      id: row.id,
      endedAt: row.ended_at,
      endSnapshot,
    })
  }

  return records
}

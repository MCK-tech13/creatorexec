import type { SupabaseClient } from '@supabase/supabase-js'
import type { SprintReview, SprintSnapshot } from '../../types/sprintReview'
import type { Database, Json } from './database.types'

type Client = SupabaseClient<Database>

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

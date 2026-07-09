import type { Database, Json } from './database.types'
import type { IncomeMonthEntry, IncomeTrackerStore } from '../../types/incomeTracker'
import type { OnboardingProfile } from '../../types/onboarding'
import type { BrandDeal } from '../../types/pipeline'
import type { ProductScoutEntry, ProductScoutMetrics } from '../../types/productScout'
import type { SprintSnapshot } from '../../types/sprintReview'
import { scoreProductScout } from '../productScout/scorer'
import { normalizeDealVideoDeliverables } from '../pipeline/videoDeliverableUtils'
import type { TrialProgressStore } from '../schedule/trialProgressStorage'

type TrialRow = Database['public']['Tables']['trial_progress']['Row']
type DealRow = Database['public']['Tables']['retainer_deals']['Row']
type IncomeRow = Database['public']['Tables']['income_entries']['Row']
type ScoutRow = Database['public']['Tables']['product_scout_list']['Row']
type OnboardingRow = Database['public']['Tables']['onboarding_state']['Row']

function asJson<T>(value: T): Json {
  return value as unknown as Json
}

export function trialProgressFromRows(rows: TrialRow[]): TrialProgressStore {
  const store: TrialProgressStore = {}
  for (const row of rows) {
    store[row.product_id] = {
      videosFilmed: Math.max(0, row.videos_filmed),
      source: row.source ?? undefined,
    }
  }
  return store
}

export function trialProgressToRows(
  userId: string,
  store: TrialProgressStore,
): Database['public']['Tables']['trial_progress']['Insert'][] {
  return Object.entries(store).map(([productId, entry]) => ({
    user_id: userId,
    product_id: productId,
    videos_filmed: Math.max(0, entry.videosFilmed),
    source: entry.source ?? null,
  }))
}

export function brandDealFromRow(row: DealRow): BrandDeal {
  return normalizeDealVideoDeliverables({
    id: row.id,
    brandName: row.brand_name,
    product: row.product ?? '',
    stage: row.stage,
    dealType: row.deal_type ?? undefined,
    compensation: row.compensation != null ? Number(row.compensation) : undefined,
    commissionPercent: row.commission_percent != null ? Number(row.commission_percent) : undefined,
    videosRequired: row.videos_required ?? undefined,
    deadlineDate: row.deadline_date ?? undefined,
    contractSigned: row.contract_signed,
    notes: row.notes ?? undefined,
    videoDeliverables: (row.video_deliverables as unknown as BrandDeal['videoDeliverables']) ?? [],
    isRetainer: row.is_retainer,
    retainerTotalVideos: row.retainer_total_videos ?? undefined,
    retainerDeadlineDate: row.retainer_deadline_date ?? undefined,
    filmingChecklist: (row.filming_checklist as unknown as BrandDeal['filmingChecklist']) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

export function brandDealToRow(
  userId: string,
  deal: BrandDeal,
): Database['public']['Tables']['retainer_deals']['Insert'] {
  return {
    id: deal.id,
    user_id: userId,
    brand_name: deal.brandName,
    product: deal.product,
    stage: deal.stage,
    deal_type: deal.dealType ?? null,
    compensation: deal.compensation ?? null,
    commission_percent: deal.commissionPercent ?? null,
    videos_required: deal.videosRequired ?? null,
    deadline_date: deal.deadlineDate ?? null,
    contract_signed: deal.contractSigned,
    notes: deal.notes ?? null,
    video_deliverables: asJson(deal.videoDeliverables),
    is_retainer: deal.isRetainer,
    retainer_total_videos: deal.retainerTotalVideos ?? null,
    retainer_deadline_date: deal.retainerDeadlineDate ?? null,
    filming_checklist: asJson(deal.filmingChecklist),
    created_at: deal.createdAt,
    updated_at: deal.updatedAt,
  }
}

export function incomeTrackerFromRows(rows: IncomeRow[]): IncomeTrackerStore {
  const store: IncomeTrackerStore = {}
  for (const row of rows) {
    store[row.month_key] = {
      gmvTotal: Number(row.gmv_total),
      estimatedCommission: Number(row.estimated_commission),
      settledCommission: Number(row.settled_commission),
      brandDealsIncome: Number(row.brand_deals_income),
      bonusesRewards: Number(row.bonuses_rewards),
    }
  }
  return store
}

export function incomeMonthToRow(
  userId: string,
  monthKey: string,
  entry: IncomeMonthEntry,
): Database['public']['Tables']['income_entries']['Insert'] {
  return {
    user_id: userId,
    month_key: monthKey,
    gmv_total: entry.gmvTotal,
    estimated_commission: entry.estimatedCommission,
    settled_commission: entry.settledCommission,
    brand_deals_income: entry.brandDealsIncome,
    bonuses_rewards: entry.bonusesRewards,
  }
}

function mapScoutVerdict(
  verdict: string,
): Database['public']['Enums']['product_scout_verdict'] | null {
  if (verdict === 'strong' || verdict === 'test' || verdict === 'pass') {
    return verdict
  }
  return null
}

export function productScoutFromRow(row: ScoutRow): ProductScoutEntry {
  return {
    id: row.id,
    productName: row.product_name,
    metrics: row.metrics as unknown as ProductScoutMetrics,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function productScoutToRow(
  userId: string,
  entry: ProductScoutEntry,
): Database['public']['Tables']['product_scout_list']['Insert'] {
  const scored = scoreProductScout(entry.metrics)
  return {
    id: entry.id,
    user_id: userId,
    product_name: entry.productName,
    metrics: asJson(entry.metrics),
    verdict: scored ? mapScoutVerdict(scored.verdict) : null,
    total_score: scored?.totalScore ?? null,
    funnel_recommendation: scored?.funnel ? asJson(scored.funnel) : null,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  }
}

export function onboardingProfileFromRow(row: OnboardingRow): OnboardingProfile | null {
  if (
    !row.completed ||
    !row.mode ||
    !row.videos_per_day ||
    !row.monthly_commission ||
    !row.filming_approach
  ) {
    return null
  }

  return {
    completed: true,
    mode: row.mode,
    videosPerDay: row.videos_per_day,
    answers: {
      monthlyCommission: row.monthly_commission,
      videosPerDay: row.videos_per_day,
      filmingApproach: row.filming_approach,
    },
  }
}

export function onboardingProfileToRow(
  userId: string,
  profile: OnboardingProfile | null,
  flags: {
    welcomeSeen: boolean
    sprintEntrySeen: boolean
    sprintStartSnapshot: SprintSnapshot | null
    sprintPreviousSnapshot: SprintSnapshot | null
  },
): Database['public']['Tables']['onboarding_state']['Insert'] {
  return {
    user_id: userId,
    completed: profile?.completed ?? false,
    mode: profile?.mode ?? null,
    videos_per_day: profile?.videosPerDay ?? null,
    monthly_commission: profile?.answers?.monthlyCommission ?? null,
    filming_approach: profile?.answers?.filmingApproach ?? null,
    welcome_seen: flags.welcomeSeen,
    sprint_entry_seen: flags.sprintEntrySeen,
    sprint_start_snapshot: flags.sprintStartSnapshot ? asJson(flags.sprintStartSnapshot) : null,
    sprint_previous_snapshot: flags.sprintPreviousSnapshot
      ? asJson(flags.sprintPreviousSnapshot)
      : null,
  }
}

export function parseSprintSnapshot(value: unknown): SprintSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const snapshot = value as SprintSnapshot
  if (!snapshot.savedAt || !Array.isArray(snapshot.products)) return null
  return snapshot
}

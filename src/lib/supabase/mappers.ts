import type { Database, Json } from './database.types'
import type {
  AppStage,
  DaySchedule,
  DeadlineProduct,
  MergedProduct,
  SampleProduct,
  SprintConfig,
} from '../../types'
import type { CurrentSprintState, FilmingProgressStore } from '../../types/currentSprint'
import type { IncomeTrackerStore } from '../../types/incomeTracker'
import type { OnboardingProfile } from '../../types/onboarding'
import type { BrandDeal } from '../../types/pipeline'
import type { ProductScoutEntry, ProductScoutMetrics } from '../../types/productScout'
import type { CatalogProduct, CatalogProductSource } from '../../types/productCatalog'
import type { SprintSnapshot } from '../../types/sprintReview'
import type { UserEngagementState } from '../../types/userEngagement'
import { emptyUserEngagement } from '../../types/userEngagement'
import {
  embedAnalysisModeInSprintConfig,
  scheduleModeForDbColumn,
  scheduleModeFromPersisted,
} from '../catalog/catalogSprint'
import { SCORING_LOGIC_VERSION, scoreProductScout } from '../productScout/scorer'
import { normalizeDealVideoDeliverables } from '../pipeline/videoDeliverableUtils'
import type { TrialProgressStore } from '../schedule/trialProgressStorage'

type TrialRow = Database['public']['Tables']['trial_progress']['Row']
type DealRow = Database['public']['Tables']['retainer_deals']['Row']
type IncomeRow = Database['public']['Tables']['income_entries']['Row']
type ScoutRow = Database['public']['Tables']['product_scout_list']['Row']
type CatalogRow = Database['public']['Tables']['user_products']['Row']
type OnboardingRow = Database['public']['Tables']['onboarding_state']['Row']
type CurrentSprintRow = Database['public']['Tables']['current_sprint_state']['Row']
type UserEngagementRow = Database['public']['Tables']['user_engagement']['Row']

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

const CATALOG_SOURCES = new Set<CatalogProductSource>([
  'csv',
  'manual',
  'sample',
  'backfill',
])

function parseCatalogSource(value: string | null | undefined): CatalogProductSource {
  if (value && CATALOG_SOURCES.has(value as CatalogProductSource)) {
    return value as CatalogProductSource
  }
  return 'manual'
}

export function catalogProductFromRow(row: CatalogRow): CatalogProduct {
  return {
    id: row.id,
    displayName: row.display_name,
    brand: row.brand,
    externalProductId: row.external_product_id,
    source: parseCatalogSource(row.source),
    isFavorite: row.is_favorite,
    gmv: Number(row.gmv) || 0,
    commission: Number(row.commission) || 0,
    itemsSold: Math.max(0, row.items_sold),
    orderCount: Math.max(0, row.order_count),
    inRotation: row.in_rotation,
    isManual: row.is_manual,
    dateReceived: row.date_received,
    firstVideoDeadline: row.first_video_deadline ?? null,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function catalogProductToRow(
  userId: string,
  product: CatalogProduct,
): Database['public']['Tables']['user_products']['Insert'] {
  return {
    id: product.id,
    user_id: userId,
    display_name: product.displayName,
    brand: product.brand,
    external_product_id: product.externalProductId,
    source: product.source,
    is_favorite: product.isFavorite,
    gmv: product.gmv,
    commission: product.commission,
    items_sold: Math.max(0, product.itemsSold),
    order_count: Math.max(0, product.orderCount),
    in_rotation: product.inRotation,
    is_manual: product.isManual,
    date_received: product.dateReceived,
    first_video_deadline: product.firstVideoDeadline,
    archived_at: product.archivedAt,
  }
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
  return rows.map((row) => ({
    id: row.id,
    monthKey: row.month_key,
    source: row.source as IncomeTrackerStore[number]['source'],
    note: row.note,
    gmvTotal: Number(row.gmv_total),
    estimatedCommission: Number(row.estimated_commission),
    settledCommission: Number(row.settled_commission),
    brandDealsIncome: Number(row.brand_deals_income),
    bonusesRewards: Number(row.bonuses_rewards),
  }))
}

export function incomeEntryToRow(
  userId: string,
  entry: IncomeTrackerStore[number],
): Database['public']['Tables']['income_entries']['Insert'] {
  return {
    id: entry.id,
    user_id: userId,
    month_key: entry.monthKey,
    source: entry.source,
    note: entry.note,
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
    scoring_logic_version: scored ? SCORING_LOGIC_VERSION : null,
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

const APP_STAGES: AppStage[] = [
  'upload',
  'sample',
  'momentum',
  'dashboard',
  'config',
  'schedule',
]

function parseAppStage(value: unknown): AppStage | null {
  return typeof value === 'string' && (APP_STAGES as string[]).includes(value)
    ? (value as AppStage)
    : null
}

function parseSprintConfig(value: unknown): SprintConfig {
  const config = value && typeof value === 'object' ? (value as Partial<SprintConfig>) : {}
  const videosPerDay = Number(config.videosPerDay)
  const sprintDays = Number(config.sprintDays)
  return {
    videosPerDay: videosPerDay >= 1 ? videosPerDay : 5,
    sprintDays: sprintDays === 3 || sprintDays === 14 ? sprintDays : 7,
  }
}

function parseFilmingProgress(value: unknown): FilmingProgressStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, count]) => [
      key,
      Math.max(0, Number(count) || 0),
    ]),
  )
}

export function currentSprintFromRow(row: CurrentSprintRow): CurrentSprintState | null {
  const stage = parseAppStage(row.stage)
  if (!stage) return null

  return {
    stage,
    // `sop` is stored as schedule_mode=full + sprint_config.analysisMode until enum migration.
    scheduleMode: scheduleModeFromPersisted(row.schedule_mode, row.sprint_config),
    fileName: row.file_name,
    sprintConfig: parseSprintConfig(row.sprint_config),
    products: Array.isArray(row.products) ? (row.products as unknown as MergedProduct[]) : [],
    deadlineProducts: Array.isArray(row.deadline_products)
      ? (row.deadline_products as unknown as DeadlineProduct[])
      : [],
    excludedProductKeys: Array.isArray(row.excluded_product_keys)
      ? row.excluded_product_keys.map(String)
      : [],
    sampleProducts: Array.isArray(row.sample_products)
      ? (row.sample_products as unknown as SampleProduct[])
      : [],
    schedule: Array.isArray(row.schedule) ? (row.schedule as unknown as DaySchedule[]) : [],
    filmingProgress: parseFilmingProgress(row.filming_progress),
    updatedAt: row.updated_at,
  }
}

export function currentSprintToRow(
  userId: string,
  state: CurrentSprintState,
): Database['public']['Tables']['current_sprint_state']['Insert'] {
  return {
    user_id: userId,
    stage: state.stage,
    schedule_mode: scheduleModeForDbColumn(state.scheduleMode),
    file_name: state.fileName,
    sprint_config: asJson(
      embedAnalysisModeInSprintConfig(state.sprintConfig, state.scheduleMode),
    ),
    products: asJson(state.products),
    deadline_products: asJson(state.deadlineProducts),
    excluded_product_keys: state.excludedProductKeys,
    sample_products: asJson(state.sampleProducts),
    schedule: asJson(state.schedule),
    filming_progress: asJson(state.filmingProgress),
  }
}

export function userEngagementFromRow(row: UserEngagementRow | null): UserEngagementState {
  if (!row) return emptyUserEngagement()
  return {
    lastCsvUploadAt: row.last_csv_upload_at,
    lastUploadReminderSentAt: row.last_upload_reminder_sent_at,
    uploadReminderDismissedAt: row.upload_reminder_dismissed_at,
  }
}

export function userEngagementToRow(
  userId: string,
  state: UserEngagementState,
): Database['public']['Tables']['user_engagement']['Insert'] {
  return {
    user_id: userId,
    last_csv_upload_at: state.lastCsvUploadAt,
    last_upload_reminder_sent_at: state.lastUploadReminderSentAt,
    upload_reminder_dismissed_at: state.uploadReminderDismissedAt,
  }
}

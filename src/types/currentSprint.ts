import type {
  AppStage,
  DaySchedule,
  DeadlineProduct,
  MergedProduct,
  SampleProduct,
  ScheduleMode,
  SprintConfig,
} from './index'

/** Day-slot filmed counts keyed like `d1::Product Name` (legacy localStorage shape). */
export type FilmingProgressStore = Record<string, number>

/** Live in-progress sprint workspace — maps 1:1 to `current_sprint_state`. */
export interface CurrentSprintState {
  stage: AppStage
  scheduleMode: ScheduleMode
  fileName: string | null
  sprintConfig: SprintConfig
  products: MergedProduct[]
  deadlineProducts: DeadlineProduct[]
  excludedProductKeys: string[]
  sampleProducts: SampleProduct[]
  schedule: DaySchedule[]
  filmingProgress: FilmingProgressStore
  updatedAt?: string
}

export function hasPersistedSprintContent(state: CurrentSprintState | null | undefined): boolean {
  if (!state) return false
  return (
    state.products.length > 0 ||
    state.sampleProducts.length > 0 ||
    state.schedule.length > 0 ||
    state.deadlineProducts.length > 0
  )
}

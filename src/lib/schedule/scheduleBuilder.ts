import type {
  DaySchedule,
  DeadlineProduct,
  MergedProduct,
  ScheduledVideo,
  ScheduleTierLabel,
  SprintConfig,
} from '../../types'
import { AngleRotationSession } from './angleRotation'
import { formatDeadlineCountdown } from './deadlineUtils'
import { formatScheduleProductName } from './scheduleDisplay'
import {
  placeProvenProductsRoundRobin,
  placeRemainingByTier,
  placeTestProductsWithSpread,
  placeTopAnchorsDaily,
  type SlotPlacementRow,
} from './schedulePlacement'
import {
  computeProductSlotAllocations,
  isLowAnchorAccount,
  selectProvenTierProducts,
  totalDeadlineSlotsNeeded,
  type ProductSlotAllocation,
} from './slotAllocation'
import { isTrialComplete, summarizeTrialScheduling } from './trialProgress'

const DEADLINE_ANGLE = 'Sample / deadline content — film ASAP'

const TIER_DAY_ORDER: Record<ScheduleTierLabel, number> = {
  Retainer: 0,
  Deadline: 1,
  Anchor: 2,
  Rising: 3,
  Test: 4,
  Cut: 5,
}

function buildDeadlineVideos(deadlineProducts: DeadlineProduct[]): ScheduledVideo[] {
  const sorted = [...deadlineProducts].sort(
    (a, b) => new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime(),
  )

  const videos: ScheduledVideo[] = []

  for (const item of sorted) {
    const label = item.brand
      ? `${item.productName} (${item.brand})`
      : item.productName

    for (let i = 0; i < item.videosRequired; i++) {
      videos.push({
        slotId: '',
        productKey: `deadline:${item.id}`,
        productId: `deadline:${item.id}`,
        productName: formatScheduleProductName(label),
        tier: 'Deadline',
        suggestedAngle: DEADLINE_ANGLE,
        commission: 0,
        videosFilmed: item.videosFilmed,
        deadlineDate: item.deadlineDate,
        brand: item.brand,
      })
    }
  }

  return videos
}

function sortByTierThenCommission(videos: ScheduledVideo[]): ScheduledVideo[] {
  return [...videos].sort((a, b) => {
    const tierDiff = TIER_DAY_ORDER[a.tier] - TIER_DAY_ORDER[b.tier]
    if (tierDiff !== 0) return tierDiff
    if (b.commission !== a.commission) return b.commission - a.commission
    return a.productName.localeCompare(b.productName)
  })
}

function remainingCapacity(perDay: ScheduledVideo[][], day: number, cap: number): number {
  return Math.max(0, cap - perDay[day].length)
}

function nextDayWithRoom(
  perDay: ScheduledVideo[][],
  cap: number,
  cursor: number,
): { day: number; nextCursor: number } | null {
  const sprintDays = perDay.length
  for (let offset = 0; offset < sprintDays; offset++) {
    const day = (cursor + offset) % sprintDays
    if (remainingCapacity(perDay, day, cap) > 0) {
      return { day, nextCursor: (day + 1) % sprintDays }
    }
  }
  return null
}

function tryPushVideo(
  perDay: ScheduledVideo[][],
  day: number,
  video: ScheduledVideo,
  cap: number,
): boolean {
  if (remainingCapacity(perDay, day, cap) <= 0) return false
  perDay[day].push(video)
  return true
}

function placeRetainerVideos(
  perDay: ScheduledVideo[][],
  retainerVideos: ScheduledVideo[],
  cap: number,
): void {
  let cursor = 0
  for (const video of retainerVideos) {
    let placed = false
    for (let attempt = 0; attempt < perDay.length; attempt++) {
      const day = (cursor + attempt) % perDay.length
      if (remainingCapacity(perDay, day, cap) > 0) {
        tryPushVideo(perDay, day, video, cap)
        cursor = (day + 1) % perDay.length
        placed = true
        break
      }
    }
    if (!placed) break
  }
}

function placeDeadlineVideos(
  perDay: ScheduledVideo[][],
  deadlineVideos: ScheduledVideo[],
  cap: number,
): void {
  let cursor = 0
  for (const video of deadlineVideos) {
    const slot = nextDayWithRoom(perDay, cap, cursor)
    if (!slot) break
    tryPushVideo(perDay, slot.day, video, cap)
    cursor = slot.nextCursor
  }
}

function buildPlacementRows(allocations: ProductSlotAllocation[]): SlotPlacementRow[] {
  return allocations.map((row) => ({
    product: row.product,
    tier: row.tier,
    remaining: row.slots,
  }))
}

function allocateSchedule(
  allocations: ProductSlotAllocation[],
  topAnchorIds: Set<string>,
  provenProductIds: Set<string>,
  retainerVideos: ScheduledVideo[],
  deadlineVideos: ScheduledVideo[],
  sprintDays: number,
  cap: number,
): ScheduledVideo[][] {
  const perDay: ScheduledVideo[][] = Array.from({ length: sprintDays }, () => [])
  const angleSession = new AngleRotationSession()

  placeRetainerVideos(perDay, retainerVideos, cap)
  placeDeadlineVideos(perDay, deadlineVideos, cap)

  const rows = buildPlacementRows(allocations)

  placeTopAnchorsDaily(perDay, topAnchorIds, rows, cap, sprintDays, angleSession)
  placeTestProductsWithSpread(perDay, rows, cap, sprintDays, angleSession)
  placeProvenProductsRoundRobin(perDay, rows, cap, provenProductIds, angleSession)
  placeRemainingByTier(perDay, rows, cap, ['Anchor', 'Rising', 'Test'], angleSession)

  angleSession.persist()

  return perDay
}

function assignSlotIds(dayNum: number, videos: ScheduledVideo[]): ScheduledVideo[] {
  return videos.map((video, slot) => ({
    ...video,
    slotId: `d${dayNum}-s${slot}-${video.productName}-${video.tier}`,
  }))
}

export function buildFilmingSchedule(
  products: MergedProduct[],
  config: SprintConfig,
  deadlineProducts: DeadlineProduct[] = [],
  excludedIds: Set<string> = new Set(),
  retainerVideos: ScheduledVideo[] = [],
): DaySchedule[] {
  const scheduleProducts = products.filter(
    (p) => p.tier !== 'Cut' && p.inRotation && !excludedIds.has(p.id),
  )

  const anchors = scheduleProducts
    .filter((p) => p.tier === 'Anchor')
    .sort((a, b) => b.commission - a.commission)

  const rising = scheduleProducts
    .filter((p) => p.tier === 'Rising')
    .sort((a, b) => b.commission - a.commission)

  const tests = scheduleProducts
    .filter((p) => p.tier === 'Test' && !isTrialComplete(p.videosFilmed))
    .sort((a, b) => b.commission - a.commission)

  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    const summary = summarizeTrialScheduling(scheduleProducts)
    console.info('[CreatorExec] Trial scheduling', {
      ...summary,
      incompletePassingToAllocator: tests.length,
    })
  }

  const lowAnchorMode = isLowAnchorAccount(anchors.length)
  const topAnchorIds = lowAnchorMode
    ? new Set<string>()
    : new Set(anchors.slice(0, 3).map((p) => p.id))

  const provenProducts = selectProvenTierProducts(anchors, rising, lowAnchorMode)
  const provenProductIds = new Set(provenProducts.map((p) => p.id))

  const { sprintDays, videosPerDay } = config
  const cap = Math.max(1, videosPerDay)
  const totalSlots = cap * sprintDays
  const deadlineSlotsNeeded = totalDeadlineSlotsNeeded(deadlineProducts)
  const retainerSlotsNeeded = retainerVideos.length

  const allocations = computeProductSlotAllocations(
    anchors,
    rising,
    tests,
    totalSlots,
    deadlineSlotsNeeded + retainerSlotsNeeded,
    sprintDays,
  )

  const deadlineVideos = buildDeadlineVideos(deadlineProducts)
  const perDay = allocateSchedule(
    allocations,
    topAnchorIds,
    provenProductIds,
    retainerVideos,
    deadlineVideos,
    sprintDays,
    cap,
  )

  return Array.from({ length: sprintDays }, (_, i) => ({
    day: i + 1,
    videos: assignSlotIds(i + 1, sortByTierThenCommission(perDay[i])),
  }))
}

export function formatScheduleText(schedule: DaySchedule[]): string {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return schedule
    .map((day) => {
      const dayLabel = dayNames[(day.day - 1) % 7]
      const lines = day.videos.map((v) => {
        const countdown =
          v.deadlineDate != null ? ` (${formatDeadlineCountdown(v.deadlineDate)})` : ''
        return `  [${v.tier}] ${v.productName}${countdown} — ${v.suggestedAngle}`
      })
      return `Day ${day.day} — ${dayLabel}\n${lines.join('\n')}`
    })
    .join('\n\n')
}

export { formatScheduleProductName, stripSchedulePromoText } from './scheduleDisplay'
export { SCHEDULE_TIER_STYLES } from '../theme/tierStyles'

function splitIntoDayChunks<T>(items: T[], dayCount: number): T[][] {
  if (dayCount <= 0) return []
  const chunks: T[][] = Array.from({ length: dayCount }, () => [])
  if (items.length === 0) return chunks

  const baseSize = Math.floor(items.length / dayCount)
  const remainder = items.length % dayCount
  let idx = 0

  for (let d = 0; d < dayCount; d++) {
    const size = baseSize + (d < remainder ? 1 : 0)
    chunks[d] = items.slice(idx, idx + size)
    idx += size
  }

  return chunks
}

export { splitIntoDayChunks }

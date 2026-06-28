import type {
  DaySchedule,
  DeadlineProduct,
  MergedProduct,
  ScheduledVideo,
  ScheduleTierLabel,
  SprintConfig,
  Tier,
} from '../../types'
import { formatDeadlineCountdown } from './deadlineUtils'
import { formatScheduleProductName } from './scheduleDisplay'

type ScheduleTier = Exclude<Tier, 'Cut'>

const TOP_ANCHOR_COUNT = 3
const TOP_ANCHOR_VIDEOS_PER_DAY = 3
const SECONDARY_ANCHOR_RANK_START = 4
const SECONDARY_ANCHOR_RANK_END = 10
const RISING_VIDEOS_PER_PRODUCT = 2

const TIER_ANGLES: Record<ScheduleTier, string> = {
  Anchor: 'UGC testimonial / before-after',
  Rising: 'Problem/solution hook',
  Test: 'First impression / unboxing',
}

const DEADLINE_ANGLE = 'Sample / deadline content — film ASAP'

const TIER_DAY_ORDER: Record<ScheduleTierLabel, number> = {
  Deadline: 0,
  Anchor: 1,
  Rising: 2,
  Test: 3,
  Cut: 4,
}

function toScheduledVideo(product: MergedProduct, tier: ScheduleTier): ScheduledVideo {
  return {
    slotId: '',
    productKey: product.id,
    productId: product.productId,
    productName: formatScheduleProductName(product.productName),
    tier,
    suggestedAngle: TIER_ANGLES[tier],
    commission: product.commission,
    videosFilmed: product.videosFilmed,
  }
}

function buildDeadlineVideos(deadlineProducts: DeadlineProduct[]): ScheduledVideo[] {
  const sorted = [...deadlineProducts].sort(
    (a, b) =>
      new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime(),
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

function dayWithMostRoom(perDay: ScheduledVideo[][], cap: number): number {
  let bestDay = -1
  let bestRoom = 0

  for (let d = 0; d < perDay.length; d++) {
    const room = remainingCapacity(perDay, d, cap)
    if (room > bestRoom) {
      bestRoom = room
      bestDay = d
    }
  }

  return bestRoom > 0 ? bestDay : -1
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

function allocateTopAnchors(
  perDay: ScheduledVideo[][],
  topAnchors: MergedProduct[],
  sprintDays: number,
): void {
  for (let d = 0; d < sprintDays; d++) {
    for (const product of topAnchors) {
      for (let v = 0; v < TOP_ANCHOR_VIDEOS_PER_DAY; v++) {
        perDay[d].push(toScheduledVideo(product, 'Anchor'))
      }
    }
  }
}

function allocateCappedSchedule(
  topAnchors: MergedProduct[],
  secondaryAnchors: MergedProduct[],
  rising: MergedProduct[],
  tests: MergedProduct[],
  deadlineVideos: ScheduledVideo[],
  sprintDays: number,
  cap: number,
): ScheduledVideo[][] {
  const perDay: ScheduledVideo[][] = Array.from({ length: sprintDays }, () => [])

  allocateTopAnchors(perDay, topAnchors, sprintDays)

  let deadlineCursor = 0
  for (const video of deadlineVideos) {
    const slot = nextDayWithRoom(perDay, cap, deadlineCursor)
    if (!slot) break
    tryPushVideo(perDay, slot.day, video, cap)
    deadlineCursor = slot.nextCursor
  }

  const sortedSecondary = [...secondaryAnchors].sort((a, b) => b.commission - a.commission)
  let secondaryCursor = 0
  for (const product of sortedSecondary) {
    const slot = nextDayWithRoom(perDay, cap, secondaryCursor)
    if (!slot) break
    tryPushVideo(perDay, slot.day, toScheduledVideo(product, 'Anchor'), cap)
    secondaryCursor = slot.nextCursor
  }

  for (const product of rising) {
    for (let v = 0; v < RISING_VIDEOS_PER_PRODUCT; v++) {
      const day = dayWithMostRoom(perDay, cap)
      if (day === -1) break
      tryPushVideo(perDay, day, toScheduledVideo(product, 'Rising'), cap)
    }
  }

  for (const product of tests) {
    const day = dayWithMostRoom(perDay, cap)
    if (day === -1) break
    tryPushVideo(perDay, day, toScheduledVideo(product, 'Test'), cap)
  }

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
): DaySchedule[] {
  const scheduleProducts = products.filter(
    (p) => p.tier !== 'Cut' && p.inRotation && !excludedIds.has(p.id),
  )

  const byCommission = [...scheduleProducts].sort((a, b) => b.commission - a.commission)

  const topAnchors = byCommission.slice(0, TOP_ANCHOR_COUNT)
  const topAnchorIds = new Set(topAnchors.map((p) => p.id))

  const secondaryAnchors = byCommission
    .slice(SECONDARY_ANCHOR_RANK_START - 1, SECONDARY_ANCHOR_RANK_END)
    .filter((p) => !topAnchorIds.has(p.id))

  const rising = scheduleProducts
    .filter((p) => p.tier === 'Rising')
    .sort((a, b) => b.commission - a.commission)

  const tests = scheduleProducts
    .filter((p) => p.tier === 'Test')
    .sort((a, b) => b.commission - a.commission)

  const { sprintDays, videosPerDay } = config
  const cap = Math.max(1, videosPerDay)

  const deadlineVideos = buildDeadlineVideos(deadlineProducts)
  const perDay = allocateCappedSchedule(
    topAnchors,
    secondaryAnchors,
    rising,
    tests,
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

import type {
  DaySchedule,
  DeadlineProduct,
  MergedProduct,
  ScheduledVideo,
  SprintConfig,
} from '../../types'
import { AngleRotationSession } from './angleRotation'
import { formatScheduleProductName } from './scheduleDisplay'
import {
  placeProvenProductsRoundRobin,
  placeRemainingByTier,
  placeTestProductsWithSpread,
  type SlotPlacementRow,
} from './schedulePlacement'
import {
  computeMomentumSlotAllocations,
  totalDeadlineSlotsNeeded,
  type ProductSlotAllocation,
} from './slotAllocation'
import { isTrialComplete } from './trialProgress'

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
        suggestedAngle: 'Sample / deadline content — film ASAP',
        commission: 0,
        videosFilmed: item.videosFilmed,
        deadlineDate: item.deadlineDate,
        brand: item.brand,
      })
    }
  }
  return videos
}

function buildPlacementRows(allocations: ProductSlotAllocation[]): SlotPlacementRow[] {
  return allocations.map((row) => ({
    product: row.product,
    tier: row.tier,
    remaining: row.slots,
  }))
}

function placeVideosRoundRobin(
  perDay: ScheduledVideo[][],
  videos: ScheduledVideo[],
  cap: number,
): void {
  let dayCursor = 0
  for (const video of videos) {
    let placed = false
    for (let attempt = 0; attempt < perDay.length; attempt++) {
      const day = (dayCursor + attempt) % perDay.length
      if (perDay[day].length < cap) {
        perDay[day].push(video)
        dayCursor = (day + 1) % perDay.length
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
    let placed = false
    for (let attempt = 0; attempt < perDay.length; attempt++) {
      const day = (cursor + attempt) % perDay.length
      if (perDay[day].length < cap) {
        perDay[day].push(video)
        cursor = (day + 1) % perDay.length
        placed = true
        break
      }
    }
    if (!placed) break
  }
}

export function buildMomentumModeSchedule(
  products: MergedProduct[],
  config: SprintConfig,
  deadlineProducts: DeadlineProduct[] = [],
  excludedIds: Set<string> = new Set(),
  retainerVideos: ScheduledVideo[] = [],
): DaySchedule[] {
  const scheduleProducts = products.filter(
    (p) => p.tier !== 'Cut' && p.tier !== 'Anchor' && p.inRotation && !excludedIds.has(p.id),
  )

  const rising = scheduleProducts
    .filter((p) => p.tier === 'Rising')
    .sort((a, b) => b.commission - a.commission)
  const tests = scheduleProducts
    .filter((p) => p.tier === 'Test' && !isTrialComplete(p.videosFilmed))
    .sort((a, b) => b.commission - a.commission)

  const { sprintDays, videosPerDay } = config
  const cap = Math.max(1, videosPerDay)
  const totalSlots = cap * sprintDays
  const deadlineSlotsNeeded = totalDeadlineSlotsNeeded(deadlineProducts)
  const retainerSlotsNeeded = retainerVideos.length

  const allocations = computeMomentumSlotAllocations(
    rising,
    tests,
    totalSlots,
    deadlineSlotsNeeded + retainerSlotsNeeded,
    sprintDays,
  )

  const risingIds = new Set(rising.map((p) => p.id))
  const angleSession = new AngleRotationSession()

  const perDay: ScheduledVideo[][] = Array.from({ length: sprintDays }, () => [])

  placeVideosRoundRobin(perDay, retainerVideos, cap)

  const deadlineVideos = buildDeadlineVideos(deadlineProducts)
  placeDeadlineVideos(perDay, deadlineVideos, cap)

  const rows = buildPlacementRows(allocations)

  placeTestProductsWithSpread(perDay, rows, cap, sprintDays, angleSession)
  placeProvenProductsRoundRobin(perDay, rows, cap, risingIds, angleSession)
  placeRemainingByTier(perDay, rows, cap, ['Rising', 'Test'], angleSession)

  angleSession.persist()

  return Array.from({ length: sprintDays }, (_, i) => ({
    day: i + 1,
    videos: perDay[i].map((video, slot) => ({
      ...video,
      slotId: `d${i + 1}-s${slot}-${video.productName}-${video.tier}`,
    })),
  }))
}

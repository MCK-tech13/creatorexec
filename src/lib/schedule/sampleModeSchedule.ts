import type {
  DaySchedule,
  DeadlineProduct,
  MergedProduct,
  SampleProduct,
  ScheduledVideo,
  SprintConfig,
} from '../../types'
import { AngleRotationSession } from './angleRotation'
import { formatScheduleProductName } from './scheduleDisplay'
import {
  assignSlotIds,
  buildDeadlineScheduledVideos,
  placeRetainerVideos,
  placeVideosRoundRobin,
  remainingDayCapacity,
} from './schedulePlacement'

/** Favorites first, then samples by date received (oldest first). */
export function sortSampleProductsForSchedule(products: SampleProduct[]): SampleProduct[] {
  const favorites = products.filter((p) => p.type === 'favorite')
  const samples = products
    .filter((p) => p.type === 'sample')
    .sort(
      (a, b) =>
        new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime(),
    )
  return [...favorites, ...samples]
}

export function sampleProductsToMerged(products: SampleProduct[]): MergedProduct[] {
  return sortSampleProductsForSchedule(products).map((p) => ({
    id: p.id,
    productName: p.brand ? `${p.productName} (${p.brand})` : p.productName,
    productId: 'sample',
    gmv: 0,
    commission: 0,
    itemsSold: 0,
    orderCount: 0,
    videosFilmed: 0,
    score: 0,
    tier: p.type === 'favorite' ? 'Rising' : 'Test',
    rankInTier: 0,
    inRotation: true,
    isManual: true,
  }))
}

function toScheduledVideo(product: MergedProduct, angleSession: AngleRotationSession): ScheduledVideo {
  const tier = product.tier === 'Rising' ? 'Rising' : 'Test'
  return {
    slotId: '',
    productKey: product.id,
    productId: product.productId,
    productName: formatScheduleProductName(product.productName),
    tier,
    suggestedAngle: angleSession.consumeAngle(product),
    commission: 0,
    videosFilmed: product.videosFilmed,
  }
}

export function buildSampleModeSchedule(
  products: MergedProduct[],
  config: SprintConfig,
  deadlineProducts: DeadlineProduct[] = [],
  retainerVideos: ScheduledVideo[] = [],
): DaySchedule[] {
  const { sprintDays, videosPerDay } = config
  const cap = Math.max(1, videosPerDay)
  const perDay: ScheduledVideo[][] = Array.from({ length: sprintDays }, () => [])

  placeRetainerVideos(perDay, retainerVideos, cap)
  placeVideosRoundRobin(perDay, buildDeadlineScheduledVideos(deadlineProducts), cap)

  const totalSlots = cap * sprintDays
  const priorityCount = perDay.reduce((sum, day) => sum + day.length, 0)
  const sampleSlots = Math.max(0, totalSlots - priorityCount)
  const toSchedule = products.slice(0, sampleSlots)
  const angleSession = new AngleRotationSession()

  let dayCursor = 0
  for (const product of toSchedule) {
    let placed = false
    for (let attempt = 0; attempt < sprintDays; attempt++) {
      const day = (dayCursor + attempt) % sprintDays
      if (remainingDayCapacity(perDay, day, cap) > 0) {
        perDay[day].push(toScheduledVideo(product, angleSession))
        dayCursor = (day + 1) % sprintDays
        placed = true
        break
      }
    }
    if (!placed) break
  }

  angleSession.persist()

  return assignSlotIds(perDay, sprintDays)
}

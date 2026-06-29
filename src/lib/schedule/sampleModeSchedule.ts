import type {
  DaySchedule,
  MergedProduct,
  SampleProduct,
  ScheduledVideo,
  SprintConfig,
} from '../../types'
import { formatScheduleProductName } from './scheduleDisplay'

const TIER_ANGLES = {
  Rising: 'Problem/solution hook',
  Test: 'First impression / unboxing',
} as const

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

function toScheduledVideo(product: MergedProduct): ScheduledVideo {
  const tier = product.tier === 'Rising' ? 'Rising' : 'Test'
  return {
    slotId: '',
    productKey: product.id,
    productId: product.productId,
    productName: formatScheduleProductName(product.productName),
    tier,
    suggestedAngle: TIER_ANGLES[tier],
    commission: 0,
    videosFilmed: product.videosFilmed,
  }
}

/** One video per product, spread evenly across sprint days. Overflow drops lowest-priority items. */
export function buildSampleModeSchedule(
  products: MergedProduct[],
  config: SprintConfig,
): DaySchedule[] {
  const { sprintDays, videosPerDay } = config
  const cap = Math.max(1, videosPerDay)
  const totalSlots = cap * sprintDays
  const toSchedule = products.slice(0, totalSlots)

  const perDay: ScheduledVideo[][] = Array.from({ length: sprintDays }, () => [])
  let dayCursor = 0

  for (const product of toSchedule) {
    let placed = false
    for (let attempt = 0; attempt < sprintDays; attempt++) {
      const day = (dayCursor + attempt) % sprintDays
      if (perDay[day].length < cap) {
        perDay[day].push(toScheduledVideo(product))
        dayCursor = (day + 1) % sprintDays
        placed = true
        break
      }
    }
    if (!placed) break
  }

  return Array.from({ length: sprintDays }, (_, i) => ({
    day: i + 1,
    videos: perDay[i].map((video, slot) => ({
      ...video,
      slotId: `d${i + 1}-s${slot}-${video.productName}-${video.tier}`,
    })),
  }))
}

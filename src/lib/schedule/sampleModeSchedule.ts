import type {
  DaySchedule,
  DeadlineProduct,
  MergedProduct,
  SampleProduct,
  ScheduledVideo,
  SprintConfig,
} from '../../types'
import { AngleRotationSession } from './angleRotation'
import {
  assignSlotIds,
  buildDeadlineScheduledVideos,
  placeRetainerVideos,
  placeVideosRoundRobin,
  remainingDayCapacity,
  toTierScheduledVideo,
} from './schedulePlacement'
import { createPlacementReasonBuilder, type PlacementReasonBuilder } from './placementReasons'

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

/**
 * Stage 2: favorites are soft priority flags — they stay Test with zero metrics.
 * Rising/Anchor still require real sales data via tierEngine.
 */
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
    tier: 'Test' as const,
    rankInTier: 0,
    inRotation: true,
    isManual: true,
    isFavorite: p.type === 'favorite',
  }))
}

function toSampleScheduledVideo(
  product: MergedProduct,
  angleSession: AngleRotationSession,
  reasonBuilder: PlacementReasonBuilder,
  alreadyPlacedInSprint: number,
): ReturnType<typeof toTierScheduledVideo> {
  const tier = product.tier === 'Rising' ? 'Rising' : 'Test'
  return toTierScheduledVideo(
    product,
    tier,
    angleSession,
    reasonBuilder.forTierPlacement(
      product.id,
      tier,
      product.videosFilmed,
      alreadyPlacedInSprint,
      'remaining',
    ),
  )
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
  const reasonBuilder = createPlacementReasonBuilder({
    mode: 'sample',
    topAnchorIds: new Set(),
    provenSlotsByProduct: new Map(),
    sprintDays,
  })

  let dayCursor = 0
  for (const product of toSchedule) {
    let placed = false
    for (let attempt = 0; attempt < sprintDays; attempt++) {
      const day = (dayCursor + attempt) % sprintDays
      if (remainingDayCapacity(perDay, day, cap) > 0) {
        const alreadyPlaced = perDay.reduce(
          (sum, videos) => sum + videos.filter((video) => video.productKey === product.id).length,
          0,
        )
        perDay[day].push(
          toSampleScheduledVideo(product, angleSession, reasonBuilder, alreadyPlaced),
        )
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

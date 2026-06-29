import type {
  DaySchedule,
  DeadlineProduct,
  MergedProduct,
  ScheduledVideo,
  SprintConfig,
} from '../../types'
import { formatScheduleProductName } from './scheduleDisplay'
import {
  allocateTestProducts,
  distributeWithMinimum,
  sumCounts,
  totalDeadlineSlotsNeeded,
  type ProductSlotAllocation,
} from './slotAllocation'

const TIER_ANGLES = {
  Rising: 'Problem/solution hook',
  Test: 'First impression / unboxing',
} as const

function sortedByCommission(products: MergedProduct[]): MergedProduct[] {
  return [...products].sort((a, b) => b.commission - a.commission)
}

export function computeMomentumSlotAllocations(
  rising: MergedProduct[],
  tests: MergedProduct[],
  totalSlots: number,
  deadlineSlotsNeeded: number,
): ProductSlotAllocation[] {
  let remaining = Math.max(0, totalSlots - deadlineSlotsNeeded)
  const sortedRising = sortedByCommission(rising)
  const sortedTests = sortedByCommission(tests)
  const allCounts = new Map<string, number>()

  const risingBudget = Math.min(remaining, sortedRising.length * 2)
  const risingAlloc = distributeWithMinimum(sortedRising, risingBudget, 2)
  for (const [id, slots] of risingAlloc.counts) {
    allCounts.set(id, slots)
  }
  remaining -= sumCounts(risingAlloc.counts)

  const testAlloc = allocateTestProducts(remaining, sortedTests)
  for (const [id, slots] of testAlloc.counts) {
    allCounts.set(id, slots)
  }

  const tierById = new Map<string, 'Rising' | 'Test'>()
  for (const product of sortedRising) tierById.set(product.id, 'Rising')
  for (const product of sortedTests) tierById.set(product.id, 'Test')

  const productById = new Map<string, MergedProduct>()
  for (const product of [...sortedRising, ...sortedTests]) {
    productById.set(product.id, product)
  }

  const allocations: ProductSlotAllocation[] = []
  for (const [id, slots] of allCounts) {
    if (slots <= 0) continue
    const product = productById.get(id)
    const tier = tierById.get(id)
    if (product && tier) {
      allocations.push({ product, tier, slots })
    }
  }

  return allocations
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

function toScheduledVideo(product: MergedProduct, tier: 'Rising' | 'Test'): ScheduledVideo {
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

function expandAllocationsEvenly(
  allocations: ProductSlotAllocation[],
): ScheduledVideo[] {
  const queues = allocations.map(({ product, tier, slots }) => ({
    videos: Array.from({ length: slots }, () =>
      toScheduledVideo(product, tier as 'Rising' | 'Test'),
    ),
  }))

  const result: ScheduledVideo[] = []
  let added = true
  while (added) {
    added = false
    for (const queue of queues) {
      const next = queue.videos.shift()
      if (next) {
        result.push(next)
        added = true
      }
    }
  }
  return result
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
): DaySchedule[] {
  const scheduleProducts = products.filter(
    (p) => p.tier !== 'Cut' && p.tier !== 'Anchor' && p.inRotation && !excludedIds.has(p.id),
  )

  const rising = scheduleProducts.filter((p) => p.tier === 'Rising')
  const tests = scheduleProducts.filter((p) => p.tier === 'Test')

  const { sprintDays, videosPerDay } = config
  const cap = Math.max(1, videosPerDay)
  const totalSlots = cap * sprintDays
  const deadlineSlotsNeeded = totalDeadlineSlotsNeeded(deadlineProducts)

  const allocations = computeMomentumSlotAllocations(
    rising,
    tests,
    totalSlots,
    deadlineSlotsNeeded,
  )

  const perDay: ScheduledVideo[][] = Array.from({ length: sprintDays }, () => [])
  const deadlineVideos = buildDeadlineVideos(deadlineProducts)
  placeDeadlineVideos(perDay, deadlineVideos, cap)

  const productVideos = expandAllocationsEvenly(allocations)
  placeVideosRoundRobin(perDay, productVideos, cap)

  return Array.from({ length: sprintDays }, (_, i) => ({
    day: i + 1,
    videos: perDay[i].map((video, slot) => ({
      ...video,
      slotId: `d${i + 1}-s${slot}-${video.productName}-${video.tier}`,
    })),
  }))
}

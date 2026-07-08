import type { DaySchedule, DeadlineProduct, MergedProduct, ScheduledVideo } from '../../types'
import type { AngleRotationSession } from './angleRotation'
import { formatScheduleProductName } from './scheduleDisplay'
import {
  MAX_PROVEN_VIDEOS_PER_DAY,
  MAX_RETAINER_VIDEOS_PER_DAY,
  MAX_RISING_VIDEOS_PER_DAY,
  MAX_TEST_VIDEOS_PER_DAY,
  MIN_TEST_SPREAD_DAYS,
  type ScheduleTier,
} from './slotAllocation'

export interface SlotPlacementRow {
  product: MergedProduct
  tier: ScheduleTier
  remaining: number
}

export function countProductOnDay(
  perDay: ScheduledVideo[][],
  day: number,
  productKey: string,
): number {
  return perDay[day].filter((video) => video.productKey === productKey).length
}

export function pickSpreadDayIndices(sprintDays: number, spreadCount: number): number[] {
  const count = Math.max(1, Math.min(sprintDays, spreadCount))
  if (count >= sprintDays) {
    return Array.from({ length: sprintDays }, (_, index) => index)
  }

  const indices: number[] = []
  for (let i = 0; i < count; i++) {
    indices.push(Math.floor((i * sprintDays) / count))
  }
  return [...new Set(indices)].sort((a, b) => a - b)
}

function remainingCapacity(perDay: ScheduledVideo[][], day: number, cap: number): number {
  return Math.max(0, cap - perDay[day].length)
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

export function maxVideosPerDayForTier(tier: ScheduleTier): number {
  if (tier === 'Test') return MAX_TEST_VIDEOS_PER_DAY
  if (tier === 'Rising') return MAX_PROVEN_VIDEOS_PER_DAY
  return MAX_PROVEN_VIDEOS_PER_DAY
}

export function maxOverflowVideosPerDayForTier(tier: ScheduleTier): number {
  if (tier === 'Test') return MAX_TEST_VIDEOS_PER_DAY
  if (tier === 'Rising') return MAX_RISING_VIDEOS_PER_DAY
  return MAX_PROVEN_VIDEOS_PER_DAY
}

export function canPlaceOverflowOnDay(
  perDay: ScheduledVideo[][],
  day: number,
  row: SlotPlacementRow,
  cap: number,
): boolean {
  if (remainingCapacity(perDay, day, cap) <= 0) return false
  return (
    countProductOnDay(perDay, day, row.product.id) <
    maxOverflowVideosPerDayForTier(row.tier)
  )
}

export function canPlaceRowOnDay(
  perDay: ScheduledVideo[][],
  day: number,
  row: SlotPlacementRow,
  cap: number,
): boolean {
  if (remainingCapacity(perDay, day, cap) <= 0) return false
  return (
    countProductOnDay(perDay, day, row.product.id) <
    maxVideosPerDayForTier(row.tier)
  )
}

function firstDayWithRoomForRow(
  perDay: ScheduledVideo[][],
  row: SlotPlacementRow,
  cap: number,
): number {
  let bestDay = -1
  let bestRoom = 0

  for (let day = 0; day < perDay.length; day++) {
    if (!canPlaceRowOnDay(perDay, day, row, cap)) continue
    const room = remainingCapacity(perDay, day, cap)
    if (room > bestRoom) {
      bestRoom = room
      bestDay = day
    }
  }

  return bestRoom > 0 ? bestDay : -1
}

export function toTierScheduledVideo(
  product: MergedProduct,
  tier: ScheduleTier,
  angleSession: AngleRotationSession,
): ScheduledVideo {
  return {
    slotId: '',
    productKey: product.id,
    productId: product.productId,
    productName: formatScheduleProductName(product.productName),
    tier,
    suggestedAngle: angleSession.consumeAngle(product),
    commission: product.commission,
    videosFilmed: product.videosFilmed,
  }
}

/** Place test slots first: max 2/day, spread across ≥3 days. */
export function placeTestProductsWithSpread(
  perDay: ScheduledVideo[][],
  rows: SlotPlacementRow[],
  cap: number,
  sprintDays: number,
  angleSession: AngleRotationSession,
): void {
  const tests = rows
    .filter((row) => row.tier === 'Test' && row.remaining > 0)
    .sort((a, b) => b.product.commission - a.product.commission)

  for (const row of tests) {
    const total = row.remaining
    const spreadCount = Math.max(
      MIN_TEST_SPREAD_DAYS,
      Math.ceil(total / MAX_TEST_VIDEOS_PER_DAY),
    )
    const spreadDays = pickSpreadDayIndices(sprintDays, spreadCount)
    let dayCursor = 0
    let safety = 0

    while (row.remaining > 0 && safety < total * sprintDays * 2) {
      safety += 1
      let placed = false

      for (let attempt = 0; attempt < spreadDays.length; attempt++) {
        const day = spreadDays[(dayCursor + attempt) % spreadDays.length]
        if (countProductOnDay(perDay, day, row.product.id) >= MAX_TEST_VIDEOS_PER_DAY) {
          continue
        }
        if (
          tryPushVideo(
            perDay,
            day,
            toTierScheduledVideo(row.product, 'Test', angleSession),
            cap,
          )
        ) {
          row.remaining -= 1
          dayCursor = (dayCursor + 1) % spreadDays.length
          placed = true
          break
        }
      }

      if (placed) continue

      for (let day = 0; day < sprintDays; day++) {
        if (countProductOnDay(perDay, day, row.product.id) >= MAX_TEST_VIDEOS_PER_DAY) {
          continue
        }
        if (
          tryPushVideo(
            perDay,
            day,
            toTierScheduledVideo(row.product, 'Test', angleSession),
            cap,
          )
        ) {
          row.remaining -= 1
          placed = true
          break
        }
      }

      if (!placed) break
    }
  }
}

/** Top 3 anchors: one appearance per day when slots remain. */
export function placeTopAnchorsDaily(
  perDay: ScheduledVideo[][],
  topAnchorIds: Set<string>,
  rows: SlotPlacementRow[],
  cap: number,
  sprintDays: number,
  angleSession: AngleRotationSession,
): void {
  const topAnchors = rows
    .filter((row) => topAnchorIds.has(row.product.id) && row.tier === 'Anchor')
    .map((row) => row.product)
    .sort((a, b) => b.commission - a.commission)

  for (let day = 0; day < sprintDays; day++) {
    for (const product of topAnchors) {
      const row = rows.find((entry) => entry.product.id === product.id)
      if (!row || row.remaining <= 0) continue
      if (countProductOnDay(perDay, day, product.id) >= MAX_PROVEN_VIDEOS_PER_DAY) {
        continue
      }
      if (
        tryPushVideo(perDay, day, toTierScheduledVideo(product, 'Anchor', angleSession), cap)
      ) {
        row.remaining -= 1
      }
    }
  }
}

/** Proven tier: round-robin across days (~3–4× per week). */
export function placeProvenProductsRoundRobin(
  perDay: ScheduledVideo[][],
  rows: SlotPlacementRow[],
  cap: number,
  provenProductIds: Set<string>,
  angleSession: AngleRotationSession,
): void {
  const proven = rows
    .filter((row) => provenProductIds.has(row.product.id) && row.remaining > 0)
    .sort((a, b) => {
      const tierOrder = { Anchor: 0, Rising: 1, Test: 2 }
      const tierDiff = tierOrder[a.tier] - tierOrder[b.tier]
      if (tierDiff !== 0) return tierDiff
      return b.product.commission - a.product.commission
    })

  let progress = true
  while (progress) {
    progress = false
    for (const row of proven) {
      if (row.remaining <= 0) continue
      const day = firstDayWithRoomForRow(perDay, row, cap)
      if (day === -1) return
      if (
        tryPushVideo(
          perDay,
          day,
          toTierScheduledVideo(row.product, row.tier, angleSession),
          cap,
        )
      ) {
        row.remaining -= 1
        progress = true
      }
    }
  }
}

export function placeRemainingByTier(
  perDay: ScheduledVideo[][],
  rows: SlotPlacementRow[],
  cap: number,
  tierOrder: ScheduleTier[],
  angleSession: AngleRotationSession,
): void {
  const ordered = rows
    .filter((row) => row.remaining > 0)
    .sort((a, b) => {
      const tierDiff = tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)
      if (tierDiff !== 0) return tierDiff
      return b.product.commission - a.product.commission
    })

  let progress = true
  while (progress) {
    progress = false
    for (const row of ordered) {
      if (row.remaining <= 0) continue
      const day = firstDayWithRoomForRow(perDay, row, cap)
      if (day === -1) break
      if (
        tryPushVideo(
          perDay,
          day,
          toTierScheduledVideo(row.product, row.tier, angleSession),
          cap,
        )
      ) {
        row.remaining -= 1
        progress = true
      }
    }
  }
}

export interface DailyFillProduct {
  product: MergedProduct
  tier: ScheduleTier
}

function countProductInSprint(perDay: ScheduledVideo[][], productKey: string): number {
  return perDay.reduce(
    (sum, day) => sum + day.filter((video) => video.productKey === productKey).length,
    0,
  )
}

/** Top up each day to `cap`, using allocated rows first then controlled overflow. */
export function fillDailyCapacity(
  perDay: ScheduledVideo[][],
  rows: SlotPlacementRow[],
  fillPool: DailyFillProduct[],
  cap: number,
  sprintDays: number,
  maxSprintByProduct: Map<string, number>,
  angleSession: AngleRotationSession,
): void {
  if (cap <= 0) return

  const tierOrder: ScheduleTier[] = ['Test', 'Rising', 'Anchor']

  for (let day = 0; day < perDay.length; day++) {
    let progress = true
    while (perDay[day].length < cap && progress) {
      progress = false
      const rowCandidates = rows
        .filter((row) => row.remaining > 0)
        .sort((a, b) => {
          const tierDiff = tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)
          if (tierDiff !== 0) return tierDiff
          return b.product.commission - a.product.commission
        })

      for (const row of rowCandidates) {
        if (perDay[day].length >= cap) break
        if (!canPlaceRowOnDay(perDay, day, row, cap)) continue
        if (
          tryPushVideo(
            perDay,
            day,
            toTierScheduledVideo(row.product, row.tier, angleSession),
            cap,
          )
        ) {
          row.remaining -= 1
          progress = true
          break
        }
      }
    }

    let poolIndex = 0
    let stagnant = 0
    const sortedPool = [...fillPool].sort((a, b) => {
      const tierDiff = tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)
      if (tierDiff !== 0) return tierDiff
      return b.product.commission - a.product.commission
    })
    const maxStagnant = sortedPool.length

    while (perDay[day].length < cap && stagnant < maxStagnant) {
      const entry = sortedPool[poolIndex % sortedPool.length]
      poolIndex += 1

      const allocatedMax = maxSprintByProduct.get(entry.product.id)
      let maxSprint: number
      if (entry.tier === 'Rising') {
        maxSprint = sprintDays * MAX_RISING_VIDEOS_PER_DAY
      } else if (entry.tier === 'Test') {
        if (allocatedMax == null) {
          stagnant += 1
          continue
        }
        maxSprint = allocatedMax
      } else {
        maxSprint = allocatedMax ?? sprintDays
      }
      if (countProductInSprint(perDay, entry.product.id) >= maxSprint) {
        stagnant += 1
        continue
      }

      const row: SlotPlacementRow = {
        product: entry.product,
        tier: entry.tier,
        remaining: 1,
      }

      if (!canPlaceOverflowOnDay(perDay, day, row, cap)) {
        stagnant += 1
        continue
      }

      if (
        tryPushVideo(
          perDay,
          day,
          toTierScheduledVideo(entry.product, entry.tier, angleSession),
          cap,
        )
      ) {
        stagnant = 0
      } else {
        stagnant += 1
      }
    }
  }
}

const DEADLINE_ANGLE = 'Sample / deadline content — film ASAP'

export function buildDeadlineScheduledVideos(
  deadlineProducts: DeadlineProduct[],
): ScheduledVideo[] {
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

export function remainingDayCapacity(
  perDay: ScheduledVideo[][],
  day: number,
  cap: number,
): number {
  return Math.max(0, cap - perDay[day].length)
}

/** Retainer videos: round-robin across days, max 2 per retainer deal per day. */
export function placeRetainerVideos(
  perDay: ScheduledVideo[][],
  retainerVideos: ScheduledVideo[],
  cap: number,
): void {
  if (retainerVideos.length === 0) return

  let cursor = 0
  const sprintDays = perDay.length

  for (const video of retainerVideos) {
    let placed = false
    for (let attempt = 0; attempt < sprintDays; attempt++) {
      const day = (cursor + attempt) % sprintDays
      if (remainingDayCapacity(perDay, day, cap) <= 0) continue
      if (
        countProductOnDay(perDay, day, video.productKey) >= MAX_RETAINER_VIDEOS_PER_DAY
      ) {
        continue
      }
      perDay[day].push(video)
      cursor = (day + 1) % sprintDays
      placed = true
      break
    }
    if (!placed) break
  }
}

export function placeVideosRoundRobin(
  perDay: ScheduledVideo[][],
  videos: ScheduledVideo[],
  cap: number,
): void {
  if (videos.length === 0) return
  let dayCursor = 0
  const sprintDays = perDay.length

  for (const video of videos) {
    let placed = false
    for (let attempt = 0; attempt < sprintDays; attempt++) {
      const day = (dayCursor + attempt) % sprintDays
      if (remainingDayCapacity(perDay, day, cap) > 0) {
        perDay[day].push(video)
        dayCursor = (day + 1) % sprintDays
        placed = true
        break
      }
    }
    if (!placed) break
  }
}

export function assignSlotIds(perDay: ScheduledVideo[][], sprintDays: number): DaySchedule[] {
  return Array.from({ length: sprintDays }, (_, i) => ({
    day: i + 1,
    videos: perDay[i].map((video, slot) => ({
      ...video,
      slotId: `d${i + 1}-s${slot}-${video.productName}-${video.tier}`,
    })),
  }))
}

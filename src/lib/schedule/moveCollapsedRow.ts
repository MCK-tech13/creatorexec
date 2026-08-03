import type { DaySchedule, ScheduledVideo } from '../../types'

function reindexDayVideos(day: number, videos: ScheduledVideo[]): ScheduledVideo[] {
  return videos.map((video, slot) => ({
    ...video,
    slotId: `d${day}-s${slot}-${video.productName}-${video.tier}`,
  }))
}

/**
 * Move every ScheduledVideo for `productKey` from one day to another.
 * Pure day placement — does not change tier/classification fields.
 * No-ops if days match, days missing, or product has no slots on fromDay.
 */
export function moveCollapsedProductDay(
  schedule: DaySchedule[],
  productKey: string,
  fromDay: number,
  toDay: number,
): DaySchedule[] {
  if (fromDay === toDay) return schedule

  const from = schedule.find((day) => day.day === fromDay)
  const to = schedule.find((day) => day.day === toDay)
  if (!from || !to) return schedule

  const moving = from.videos.filter((video) => video.productKey === productKey)
  if (moving.length === 0) return schedule

  const remainingFrom = from.videos.filter((video) => video.productKey !== productKey)

  return schedule.map((day) => {
    if (day.day === fromDay) {
      return { day: day.day, videos: reindexDayVideos(fromDay, remainingFrom) }
    }
    if (day.day === toDay) {
      return {
        day: day.day,
        videos: reindexDayVideos(toDay, [...day.videos, ...moving]),
      }
    }
    return day
  })
}

/** Filming checkmark keys are `d{day}::{productName}` — migrate when a row changes day. */
export function filmingStorageKey(day: number, productName: string): string {
  return `d${day}::${productName}`
}

/**
 * Move filmed-count progress for a collapsed row from one day key to another.
 * If the destination day already has a count for the same product name, sums them.
 */
export function migrateFilmingProgressForMove(
  progress: Record<string, number>,
  productName: string,
  fromDay: number,
  toDay: number,
): Record<string, number> {
  if (fromDay === toDay) return progress

  const fromKey = filmingStorageKey(fromDay, productName)
  const toKey = filmingStorageKey(toDay, productName)
  const fromCount = progress[fromKey] ?? 0
  if (fromCount <= 0 && !(fromKey in progress)) return progress

  const next = { ...progress }
  const merged = (next[toKey] ?? 0) + fromCount
  if (merged > 0) next[toKey] = merged
  else delete next[toKey]
  delete next[fromKey]
  return next
}

export function dayVideoOverage(
  schedule: DaySchedule[],
  videosPerDay: number,
): Array<{ day: number; count: number; target: number }> {
  if (videosPerDay <= 0) return []
  return schedule
    .map((day) => ({
      day: day.day,
      count: day.videos.length,
      target: videosPerDay,
    }))
    .filter((entry) => entry.count > entry.target)
}

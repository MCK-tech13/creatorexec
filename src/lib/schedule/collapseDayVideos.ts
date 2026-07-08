import type { DaySchedule, ScheduledVideo, ScheduleTierLabel } from '../../types'
import { mergePlacementReasons } from './placementReasons'

export interface CollapsedScheduleRow {
  rowKey: string
  productKey: string
  productName: string
  tier: ScheduleTierLabel
  suggestedAngle: string
  placementReason: string
  deadlineDate?: string
  total: number
  slotIds: string[]
  storageKey: string
  videosFilmed: number
}

export function collapseDayVideos(day: number, videos: ScheduledVideo[]): CollapsedScheduleRow[] {
  const rows: CollapsedScheduleRow[] = []
  const indexByName = new Map<string, number>()

  for (const video of videos) {
    const nameKey = video.productName
    const existingIdx = indexByName.get(nameKey)

    if (existingIdx !== undefined) {
      rows[existingIdx].total += 1
      rows[existingIdx].slotIds.push(video.slotId)
      rows[existingIdx].placementReason = mergePlacementReasons([
        rows[existingIdx].placementReason,
        video.placementReason ?? '',
      ])
      if (!rows[existingIdx].deadlineDate && video.deadlineDate) {
        rows[existingIdx].deadlineDate = video.deadlineDate
      }
    } else {
      indexByName.set(nameKey, rows.length)
      rows.push({
        rowKey: nameKey,
        productKey: video.productKey,
        productName: video.productName,
        tier: video.tier,
        suggestedAngle: video.suggestedAngle,
        placementReason: video.placementReason ?? '',
        deadlineDate: video.deadlineDate,
        total: 1,
        slotIds: [video.slotId],
        storageKey: `d${day}::${nameKey}`,
        videosFilmed: video.videosFilmed,
      })
    }
  }

  return rows
}

export function collapseSchedule(schedule: DaySchedule[]): Map<number, CollapsedScheduleRow[]> {
  const collapsed = new Map<number, CollapsedScheduleRow[]>()
  for (const day of schedule) {
    collapsed.set(day.day, collapseDayVideos(day.day, day.videos))
  }
  return collapsed
}

export function dayFilmedTotal(
  day: number,
  videos: ScheduledVideo[],
  getCount: (key: string) => number,
): number {
  const collapsed = collapseDayVideos(day, videos)
  return collapsed.reduce((sum, row) => sum + getCount(row.storageKey), 0)
}

import type { DaySchedule, DeadlineProduct, ScheduledVideo } from '../../types'
import { formatScheduleProductName } from './scheduleDisplay'

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

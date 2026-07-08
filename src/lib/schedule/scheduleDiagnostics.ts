import type { DaySchedule } from '../../types'

export interface DailyCapacitySummary {
  day: number
  configured: number
  scheduled: number
  gap: number
}

export function summarizeDailyCapacity(
  schedule: DaySchedule[],
  configuredPerDay: number,
): DailyCapacitySummary[] {
  return schedule.map((day) => ({
    day: day.day,
    configured: configuredPerDay,
    scheduled: day.videos.length,
    gap: Math.max(0, configuredPerDay - day.videos.length),
  }))
}

export function logDailyCapacityDiagnostics(
  schedule: DaySchedule[],
  configuredPerDay: number,
  context?: Record<string, unknown>,
): void {
  if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) return

  const perDay = summarizeDailyCapacity(schedule, configuredPerDay)
  const totalGap = perDay.reduce((sum, row) => sum + row.gap, 0)

  console.info('[CreatorExec] Daily capacity', {
    videosPerDay: configuredPerDay,
    sprintDays: schedule.length,
    perDay,
    totalGap,
    ...context,
  })

  if (totalGap > 0) {
    console.warn(
      `[CreatorExec] Schedule under-filled by ${totalGap} slot(s) across the sprint`,
    )
  }
}

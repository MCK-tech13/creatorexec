/** Shared pure helpers for CSV upload overdue reminders (client + scripts). */

export const UPLOAD_REMINDER_EMAIL_COOLDOWN_DAYS = 7
export const DEFAULT_SPRINT_DAYS = 7

export type SprintDaysLength = 3 | 7 | 14

export function normalizeSprintDays(value: unknown): SprintDaysLength {
  const days = Number(value)
  if (days === 3 || days === 14) return days
  return 7
}

export function daysBetween(earlierIso: string, later: Date = new Date()): number {
  const earlier = new Date(earlierIso)
  if (Number.isNaN(earlier.getTime())) return 0
  const ms = later.getTime() - earlier.getTime()
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

export function isUploadOverdue(
  lastCsvUploadAt: string | null | undefined,
  sprintDays: unknown,
  now: Date = new Date(),
): boolean {
  if (!lastCsvUploadAt) return false
  const length = normalizeSprintDays(sprintDays)
  return daysBetween(lastCsvUploadAt, now) > length
}

/** Banner: overdue and not dismissed since the most recent upload. */
export function shouldShowUploadReminderBanner(options: {
  lastCsvUploadAt: string | null | undefined
  sprintDays: unknown
  dismissedAt: string | null | undefined
  now?: Date
}): boolean {
  if (!isUploadOverdue(options.lastCsvUploadAt, options.sprintDays, options.now)) {
    return false
  }
  if (!options.dismissedAt) return true
  if (!options.lastCsvUploadAt) return true
  return new Date(options.dismissedAt).getTime() < new Date(options.lastCsvUploadAt).getTime()
}

/** Email: overdue and past the cooldown since the last reminder send. */
export function shouldSendUploadReminderEmail(options: {
  lastCsvUploadAt: string | null | undefined
  sprintDays: unknown
  lastReminderSentAt: string | null | undefined
  now?: Date
  cooldownDays?: number
}): boolean {
  const now = options.now ?? new Date()
  if (!isUploadOverdue(options.lastCsvUploadAt, options.sprintDays, now)) {
    return false
  }
  if (!options.lastReminderSentAt) return true
  const cooldown = options.cooldownDays ?? UPLOAD_REMINDER_EMAIL_COOLDOWN_DAYS
  return daysBetween(options.lastReminderSentAt, now) >= cooldown
}

/**
 * Pure + server helpers for overdue CSV upload reminder cron.
 * Kept dependency-light so unit tests can import without Stripe.
 */

export const UPLOAD_REMINDER_EMAIL_COOLDOWN_DAYS = 7
export const DEFAULT_SPRINT_DAYS = 7

export function normalizeSprintDays(value) {
  const days = Number(value)
  if (days === 3 || days === 14) return days
  return 7
}

export function daysBetween(earlierIso, later = new Date()) {
  const earlier = new Date(earlierIso)
  if (Number.isNaN(earlier.getTime())) return 0
  const ms = later.getTime() - earlier.getTime()
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

export function isUploadOverdue(lastCsvUploadAt, sprintDays, now = new Date()) {
  if (!lastCsvUploadAt) return false
  const length = normalizeSprintDays(sprintDays)
  return daysBetween(lastCsvUploadAt, now) > length
}

export function shouldSendUploadReminderEmail({
  lastCsvUploadAt,
  sprintDays,
  lastReminderSentAt,
  now = new Date(),
  cooldownDays = UPLOAD_REMINDER_EMAIL_COOLDOWN_DAYS,
}) {
  if (!isUploadOverdue(lastCsvUploadAt, sprintDays, now)) return false
  if (!lastReminderSentAt) return true
  return daysBetween(lastReminderSentAt, now) >= cooldownDays
}

export function sprintDaysFromConfigJson(sprintConfig) {
  if (!sprintConfig || typeof sprintConfig !== 'object') return DEFAULT_SPRINT_DAYS
  return normalizeSprintDays(sprintConfig.sprintDays)
}

/**
 * Decide which subscribed users should receive a reminder email.
 * @param {Array<{
 *   userId: string
 *   email: string | null
 *   fullName?: string | null
 *   lastCsvUploadAt: string | null
 *   lastReminderSentAt: string | null
 *   sprintDays: number
 * }>} candidates
 * @param {Date} [now]
 */
export function selectUploadReminderRecipients(candidates, now = new Date()) {
  const recipients = []
  for (const candidate of candidates) {
    if (!candidate.email) continue
    if (
      !shouldSendUploadReminderEmail({
        lastCsvUploadAt: candidate.lastCsvUploadAt,
        sprintDays: candidate.sprintDays,
        lastReminderSentAt: candidate.lastReminderSentAt,
        now,
      })
    ) {
      continue
    }
    recipients.push({
      userId: candidate.userId,
      email: candidate.email,
      fullName: candidate.fullName ?? null,
      sprintDays: normalizeSprintDays(candidate.sprintDays),
      daysSinceUpload: daysBetween(candidate.lastCsvUploadAt, now),
    })
  }
  return recipients
}

export function isAuthorizedCronRequest(authHeader, cronSecret) {
  if (!cronSecret) return false
  if (typeof authHeader !== 'string') return false
  return authHeader === `Bearer ${cronSecret}`
}

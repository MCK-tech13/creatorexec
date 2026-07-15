/**
 * Run: npx tsx scripts/verify-upload-reminder.ts
 */
import {
  daysBetween,
  isUploadOverdue,
  shouldSendUploadReminderEmail,
  shouldShowUploadReminderBanner,
  UPLOAD_REMINDER_EMAIL_COOLDOWN_DAYS,
} from '../src/lib/reminders/uploadReminder'
import {
  selectUploadReminderRecipients,
  isAuthorizedCronRequest,
} from '../server/uploadReminder.mjs'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function daysAgo(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function runOverdueLogic(): void {
  const now = new Date('2026-07-15T12:00:00.000Z')

  assert(!isUploadOverdue(null, 7, now), 'Never uploaded → not overdue')
  assert(!isUploadOverdue(daysAgo(7, now), 7, now), 'Exactly sprint length → not overdue')
  assert(isUploadOverdue(daysAgo(8, now), 7, now), 'Day after sprint length → overdue')
  assert(!isUploadOverdue(daysAgo(3, now), 7, now), 'Within sprint → not overdue')
  assert(isUploadOverdue(daysAgo(4, now), 3, now), 'Respects 3-day sprint length')
  assert(daysBetween(daysAgo(10, now), now) === 10, 'daysBetween counts whole days')

  console.log('Overdue logic checks passed.')
}

function runBannerLogic(): void {
  const now = new Date('2026-07-15T12:00:00.000Z')
  const uploadAt = daysAgo(10, now)

  assert(
    shouldShowUploadReminderBanner({
      lastCsvUploadAt: uploadAt,
      sprintDays: 7,
      dismissedAt: null,
      now,
    }),
    'Overdue undismissed → show banner',
  )

  assert(
    !shouldShowUploadReminderBanner({
      lastCsvUploadAt: uploadAt,
      sprintDays: 7,
      dismissedAt: daysAgo(1, now),
      now,
    }),
    'Dismissed after upload → hide banner',
  )

  assert(
    shouldShowUploadReminderBanner({
      lastCsvUploadAt: uploadAt,
      sprintDays: 7,
      dismissedAt: daysAgo(12, now),
      now,
    }),
    'Dismissed before latest upload → show again when overdue',
  )

  console.log('Banner dismiss checks passed.')
}

function runEmailCooldown(): void {
  const now = new Date('2026-07-15T12:00:00.000Z')
  const uploadAt = daysAgo(10, now)

  assert(
    shouldSendUploadReminderEmail({
      lastCsvUploadAt: uploadAt,
      sprintDays: 7,
      lastReminderSentAt: null,
      now,
    }),
    'First overdue reminder → send',
  )

  assert(
    !shouldSendUploadReminderEmail({
      lastCsvUploadAt: uploadAt,
      sprintDays: 7,
      lastReminderSentAt: daysAgo(2, now),
      now,
    }),
    'Inside 7-day cooldown → do not send',
  )

  assert(
    shouldSendUploadReminderEmail({
      lastCsvUploadAt: uploadAt,
      sprintDays: 7,
      lastReminderSentAt: daysAgo(UPLOAD_REMINDER_EMAIL_COOLDOWN_DAYS, now),
      now,
    }),
    'At cooldown boundary → send again',
  )

  const recipients = selectUploadReminderRecipients(
    [
      {
        userId: 'u1',
        email: 'active@example.com',
        lastCsvUploadAt: uploadAt,
        lastReminderSentAt: null,
        sprintDays: 7,
      },
      {
        userId: 'u2',
        email: 'fresh@example.com',
        lastCsvUploadAt: daysAgo(2, now),
        lastReminderSentAt: null,
        sprintDays: 7,
      },
      {
        userId: 'u3',
        email: null,
        lastCsvUploadAt: uploadAt,
        lastReminderSentAt: null,
        sprintDays: 7,
      },
      {
        userId: 'u4',
        email: 'canceled-but-would-be-filtered-upstream@example.com',
        lastCsvUploadAt: uploadAt,
        lastReminderSentAt: daysAgo(1, now),
        sprintDays: 7,
      },
    ],
    now,
  )

  assert(recipients.length === 1, 'Only one recipient should be email-eligible')
  assert(recipients[0]?.email === 'active@example.com', 'Correct recipient selected')
  assert(recipients[0]?.daysSinceUpload === 10, 'Days since upload populated')

  assert(isAuthorizedCronRequest('Bearer secret123', 'secret123'), 'Cron auth accepts bearer')
  assert(!isAuthorizedCronRequest('Bearer wrong', 'secret123'), 'Cron auth rejects wrong secret')
  assert(!isAuthorizedCronRequest('Bearer secret123', null), 'Cron auth rejects missing secret')

  console.log('Email cooldown + recipient selection checks passed.')
}

try {
  runOverdueLogic()
  runBannerLogic()
  runEmailCooldown()
  console.log('\nAll upload reminder verification checks passed.')
} catch (error) {
  console.error('\nVERIFICATION FAILED:', error)
  process.exit(1)
}

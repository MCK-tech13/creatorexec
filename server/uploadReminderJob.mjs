import { getServerEnv } from './env.mjs'
import { getSupabaseAdmin } from './supabaseAdmin.mjs'
import {
  selectUploadReminderRecipients,
  sprintDaysFromConfigJson,
} from './uploadReminder.mjs'
import {
  buildUploadReminderEmailHtml,
  buildUploadReminderEmailText,
  sendUploadReminderEmailViaResend,
} from './emails/uploadReminderEmail.mjs'

const ACTIVE_STATUSES = ['active', 'trialing']

/**
 * Load active/trialing subscribers with engagement + sprint config.
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 */
export async function loadUploadReminderCandidates(admin) {
  const { data: subscriptions, error: subError } = await admin
    .from('user_subscriptions')
    .select('user_id, subscription_status')
    .in('subscription_status', ACTIVE_STATUSES)

  if (subError) throw subError

  const userIds = (subscriptions ?? []).map((row) => row.user_id)
  if (userIds.length === 0) return []

  const [{ data: engagementRows, error: engagementError }, { data: sprintRows, error: sprintError }] =
    await Promise.all([
      admin.from('user_engagement').select('*').in('user_id', userIds),
      admin.from('current_sprint_state').select('user_id, sprint_config').in('user_id', userIds),
    ])

  if (engagementError) throw engagementError
  if (sprintError) throw sprintError

  const engagementByUser = new Map((engagementRows ?? []).map((row) => [row.user_id, row]))
  const sprintByUser = new Map((sprintRows ?? []).map((row) => [row.user_id, row]))

  /** @type {Array<{userId:string,email:string|null,fullName:string|null,lastCsvUploadAt:string|null,lastReminderSentAt:string|null,sprintDays:number}>} */
  const candidates = []

  for (const userId of userIds) {
    const engagement = engagementByUser.get(userId)
    const sprint = sprintByUser.get(userId)
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId)
    if (userError || !userData?.user) {
      console.warn(`[upload-reminder] could not load auth user ${userId}`, userError?.message)
      continue
    }

    const user = userData.user
    candidates.push({
      userId,
      email: user.email ?? null,
      fullName:
        (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
        (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
        null,
      lastCsvUploadAt: engagement?.last_csv_upload_at ?? null,
      lastReminderSentAt: engagement?.last_upload_reminder_sent_at ?? null,
      sprintDays: sprintDaysFromConfigJson(sprint?.sprint_config),
    })
  }

  return candidates
}

/**
 * Daily upload-reminder job for active/trialing subscribers.
 * @param {{ dryRun?: boolean, now?: Date }} [options]
 */
export async function runUploadReminderJob(options = {}) {
  const dryRun = Boolean(options.dryRun)
  const now = options.now ?? new Date()
  const env = getServerEnv()

  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return {
      ok: false,
      error: 'Supabase admin credentials are not configured',
      dryRun,
      scanned: 0,
      eligible: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    }
  }

  const admin = getSupabaseAdmin(env.supabaseUrl, env.supabaseServiceRoleKey)
  const candidates = await loadUploadReminderCandidates(admin)
  const recipients = selectUploadReminderRecipients(candidates, now)

  const summary = {
    ok: true,
    dryRun,
    scanned: candidates.length,
    eligible: recipients.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: /** @type {string[]} */ ([]),
    preview: dryRun
      ? recipients.map((r) => ({
          email: r.email,
          sprintDays: r.sprintDays,
          daysSinceUpload: r.daysSinceUpload,
        }))
      : undefined,
  }

  if (dryRun) return summary

  if (!env.resendApiKey) {
    return {
      ...summary,
      ok: false,
      error: 'RESEND_API_KEY is not configured',
      skipped: recipients.length,
    }
  }

  for (const recipient of recipients) {
    const html = buildUploadReminderEmailHtml({
      recipientName: recipient.fullName,
      recipientEmail: recipient.email,
      appUrl: env.appUrl,
      sprintDays: recipient.sprintDays,
      daysSinceUpload: recipient.daysSinceUpload,
    })
    const text = buildUploadReminderEmailText({
      recipientName: recipient.fullName,
      recipientEmail: recipient.email,
      appUrl: env.appUrl,
      sprintDays: recipient.sprintDays,
      daysSinceUpload: recipient.daysSinceUpload,
    })

    const result = await sendUploadReminderEmailViaResend({
      apiKey: env.resendApiKey,
      to: recipient.email,
      html,
      text,
    })

    if (!result.ok) {
      if (result.skipped) summary.skipped += 1
      else summary.failed += 1
      summary.errors.push(`${recipient.email}: ${result.error}`)
      continue
    }

    const { data: existing } = await admin
      .from('user_engagement')
      .select('*')
      .eq('user_id', recipient.userId)
      .maybeSingle()

    const { error: upsertError } = await admin.from('user_engagement').upsert({
      user_id: recipient.userId,
      last_csv_upload_at: existing?.last_csv_upload_at ?? null,
      upload_reminder_dismissed_at: existing?.upload_reminder_dismissed_at ?? null,
      last_upload_reminder_sent_at: now.toISOString(),
    })

    if (upsertError) {
      summary.failed += 1
      summary.errors.push(
        `${recipient.email}: sent but failed to record timestamp (${upsertError.message})`,
      )
      continue
    }

    summary.sent += 1
    console.log(
      `[upload-reminder] sent to ${recipient.email} (${recipient.daysSinceUpload}d > ${recipient.sprintDays}d sprint)`,
    )
  }

  return summary
}

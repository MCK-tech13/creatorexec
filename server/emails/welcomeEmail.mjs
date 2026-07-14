import { getPlanDisplayName } from '../planCatalog.mjs'

export const WELCOME_EMAIL_SUBJECT = "Welcome to CreatorExec — you're in! 🎬"
export const WELCOME_EMAIL_FROM = 'CreatorExec <support@creatorexec.app>'

/**
 * @param {number | null | undefined} unitAmountCents
 * @param {string | null | undefined} currency
 */
export function formatMoneyFromStripe(unitAmountCents, currency = 'usd') {
  if (typeof unitAmountCents !== 'number' || Number.isNaN(unitAmountCents)) {
    return null
  }
  const code = (currency || 'usd').toUpperCase()
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
    }).format(unitAmountCents / 100)
  } catch {
    return `${(unitAmountCents / 100).toFixed(2)} ${code}`
  }
}

/**
 * @param {string | null | undefined} interval
 * @param {number | null | undefined} intervalCount
 */
export function formatBillingInterval(interval, intervalCount = 1) {
  if (!interval) return null
  const count = typeof intervalCount === 'number' && intervalCount > 0 ? intervalCount : 1
  if (count === 1) {
    if (interval === 'month') return 'billed monthly'
    if (interval === 'year') return 'billed yearly'
    if (interval === 'week') return 'billed weekly'
    if (interval === 'day') return 'billed daily'
    return `billed per ${interval}`
  }
  return `billed every ${count} ${interval}s`
}

/**
 * @param {string | null | undefined} interval
 */
export function formatIntervalPerPeriod(interval) {
  if (interval === 'month') return '/month'
  if (interval === 'year') return '/year'
  if (interval === 'week') return '/week'
  if (interval === 'day') return '/day'
  return interval ? `/${interval}` : ''
}

/**
 * Derive trial length in days from Stripe subscription timestamps.
 * @param {any} subscription
 */
export function getTrialDays(subscription) {
  const start = subscription?.trial_start
  const end = subscription?.trial_end
  if (typeof start === 'number' && typeof end === 'number' && end > start) {
    const days = Math.round((end - start) / 86_400)
    if (days > 0) return days
  }
  return 7
}

/**
 * Pull amount/interval/price from a Stripe Subscription (preferred) or Checkout Session.
 * @param {{ subscription?: any, session?: any }} sources
 */
export function extractPlanPricing({ subscription = null, session = null } = {}) {
  const priceFromSubscription = subscription?.items?.data?.[0]?.price ?? null
  const priceFromSessionLine = session?.line_items?.data?.[0]?.price ?? null
  const price = priceFromSubscription ?? priceFromSessionLine

  const priceId =
    (typeof price === 'object' && price?.id) ||
    session?.metadata?.price_id ||
    subscription?.metadata?.price_id ||
    null

  const unitAmount =
    typeof price?.unit_amount === 'number'
      ? price.unit_amount
      : typeof session?.amount_total === 'number'
        ? session.amount_total
        : null

  const currency = price?.currency ?? session?.currency ?? 'usd'
  const interval = price?.recurring?.interval ?? null
  const intervalCount = price?.recurring?.interval_count ?? 1
  const isTrialing = subscription?.status === 'trialing'
  const trialDays = isTrialing ? getTrialDays(subscription) : null

  return {
    priceId: typeof priceId === 'string' ? priceId : null,
    unitAmount,
    currency,
    interval,
    intervalCount,
    isTrialing,
    trialDays,
    planDisplayName: getPlanDisplayName(typeof priceId === 'string' ? priceId : null),
    amountLabel: formatMoneyFromStripe(unitAmount, currency),
    intervalLabel: formatBillingInterval(interval, intervalCount),
  }
}

/**
 * Plan summary line under the plan name (trial vs paid).
 * @param {{
 *   isTrialing?: boolean
 *   trialDays?: number | null
 *   amountLabel: string | null
 *   intervalLabel: string | null
 *   interval?: string | null
 * }} pricing
 */
export function formatPlanSummaryLine(pricing) {
  const amount = pricing.amountLabel || '—'
  if (pricing.isTrialing) {
    const days = pricing.trialDays && pricing.trialDays > 0 ? pricing.trialDays : 7
    const per = formatIntervalPerPeriod(pricing.interval)
    return `Free for ${days} days, then ${amount}${per}`
  }
  const interval = pricing.intervalLabel || 'recurring subscription'
  return `${amount} · ${interval}`
}

/**
 * Intro sentence after the greeting.
 * @param {{ isTrialing?: boolean, trialDays?: number | null }} options
 */
export function welcomeIntroSentence({ isTrialing = false, trialDays = null } = {}) {
  if (isTrialing) {
    const days = trialDays && trialDays > 0 ? trialDays : 7
    return `thanks for joining CreatorExec — your ${days}-day free trial has started.`
  }
  return 'thanks for joining CreatorExec — your subscription is active.'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function greetingName(recipientName, recipientEmail) {
  const trimmed = recipientName?.trim()
  if (trimmed) return trimmed
  if (recipientEmail && recipientEmail.includes('@')) {
    return recipientEmail.split('@')[0]
  }
  return 'there'
}

/**
 * @param {{
 *   recipientName?: string | null
 *   recipientEmail: string
 *   appUrl: string
 *   planDisplayName: string
 *   amountLabel: string | null
 *   intervalLabel: string | null
 *   interval?: string | null
 *   isTrialing?: boolean
 *   trialDays?: number | null
 * }} options
 */
export function buildWelcomeEmailHtml(options) {
  const appUrl = (options.appUrl || 'https://creatorexec.app').replace(/\/$/, '')
  const name = greetingName(options.recipientName, options.recipientEmail)
  const planName = options.planDisplayName || 'CreatorExec'
  const isTrialing = Boolean(options.isTrialing)
  const intro = welcomeIntroSentence({ isTrialing, trialDays: options.trialDays })
  const planSummary = formatPlanSummaryLine({
    isTrialing,
    trialDays: options.trialDays,
    amountLabel: options.amountLabel,
    intervalLabel: options.intervalLabel,
    interval: options.interval,
  })
  const privacyUrl = `${appUrl}/privacy`
  const termsUrl = `${appUrl}/terms`
  const appLink = `${appUrl}/app`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(WELCOME_EMAIL_SUBJECT)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#faf7f2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#faf7f2;margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e8e0d4;">
          <tr>
            <td style="padding:28px 28px 8px 28px;background-color:#ffffff;">
              <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#1a4a3a;font-weight:600;">
                CreatorExec
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 0 28px;">
              <h1 style="margin:0;font-family:Georgia,'Playfair Display',Times,serif;font-size:36px;line-height:1.15;color:#1a4a3a;font-weight:700;">
                You&rsquo;re in!
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 0 28px;">
              <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#5c564c;">
                Hi ${escapeHtml(name)}, ${escapeHtml(intro)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#faf7f2;border:1px solid #e8e0d4;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 6px 0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#1a4a3a;font-weight:600;">
                      Your plan
                    </p>
                    <p style="margin:0;font-family:Georgia,'Playfair Display',Times,serif;font-size:22px;line-height:1.3;color:#1a1a1a;font-weight:700;">
                      ${escapeHtml(planName)}
                    </p>
                    <p style="margin:8px 0 0 0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#5c564c;">
                      ${escapeHtml(planSummary)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 0 28px;">
              <p style="margin:0 0 8px 0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#1a4a3a;font-weight:600;">
                What&rsquo;s next
              </p>
              <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#5c564c;">
                Open your dashboard to upload a commission report, build your first sprint, and start tracking deals.
              </p>
            </td>
          </tr>
          <tr>
            <td align="left" style="padding:22px 28px 8px 28px;">
              <a href="${escapeHtml(appLink)}" style="display:inline-block;background-color:#1a4a3a;color:#ffffff;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:14px 22px;border:0;">
                Go to CreatorExec →
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 24px 28px;border-top:1px solid #e8e0d4;margin-top:16px;">
              <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8276;">
                Questions? Email
                <a href="mailto:support@creatorexec.app" style="color:#1a4a3a;text-decoration:underline;">support@creatorexec.app</a>
              </p>
              <p style="margin:10px 0 0 0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8276;">
                <a href="${escapeHtml(privacyUrl)}" style="color:#1a4a3a;text-decoration:underline;">Privacy Policy</a>
                &nbsp;&middot;&nbsp;
                <a href="${escapeHtml(termsUrl)}" style="color:#1a4a3a;text-decoration:underline;">Terms of Service</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * @param {{
 *   recipientName?: string | null
 *   recipientEmail: string
 *   appUrl: string
 *   planDisplayName: string
 *   amountLabel: string | null
 *   intervalLabel: string | null
 *   interval?: string | null
 *   isTrialing?: boolean
 *   trialDays?: number | null
 * }} options
 */
export function buildWelcomeEmailText(options) {
  const appUrl = (options.appUrl || 'https://creatorexec.app').replace(/\/$/, '')
  const name = greetingName(options.recipientName, options.recipientEmail)
  const planName = options.planDisplayName || 'CreatorExec'
  const isTrialing = Boolean(options.isTrialing)
  const intro = welcomeIntroSentence({ isTrialing, trialDays: options.trialDays })
  const planSummary = formatPlanSummaryLine({
    isTrialing,
    trialDays: options.trialDays,
    amountLabel: options.amountLabel,
    intervalLabel: options.intervalLabel,
    interval: options.interval,
  })

  return [
    "You're in!",
    '',
    `Hi ${name}, ${intro}`,
    '',
    'Your plan',
    `${planName}`,
    planSummary,
    '',
    "What's next",
    `Open your dashboard: ${appUrl}/app`,
    '',
    'Questions? Email support@creatorexec.app',
    `Privacy: ${appUrl}/privacy`,
    `Terms: ${appUrl}/terms`,
  ].join('\n')
}

/**
 * Send via Resend HTTP API. Returns { ok, id?, skipped?, error? }.
 * Never throws for missing config — caller decides whether to fail the webhook.
 *
 * @param {{
 *   apiKey?: string | null
 *   to: string
 *   html: string
 *   text: string
 *   subject?: string
 *   from?: string
 * }} options
 */
export async function sendWelcomeEmailViaResend(options) {
  const apiKey = options.apiKey?.trim()
  if (!apiKey) {
    return { ok: false, skipped: true, error: 'RESEND_API_KEY is not configured' }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: options.from ?? WELCOME_EMAIL_FROM,
      to: [options.to],
      subject: options.subject ?? WELCOME_EMAIL_SUBJECT,
      html: options.html,
      text: options.text,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : `Resend API error (${response.status})`
    return { ok: false, skipped: false, error: message, status: response.status }
  }

  return { ok: true, id: payload?.id ?? null }
}

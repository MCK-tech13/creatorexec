import { formatMoneyFromStripe, formatBillingInterval, formatIntervalPerPeriod } from './welcomeEmail.mjs'

export const TRIAL_CONVERSION_EMAIL_SUBJECT = 'Your free trial has ended — here’s your first charge'
export const TRIAL_CONVERSION_EMAIL_FROM = 'CreatorExec <support@creatorexec.app>'

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function greetingName(recipientName, recipientEmail) {
  const trimmed = typeof recipientName === 'string' ? recipientName.trim() : ''
  if (trimmed) return trimmed.split(/\s+/)[0]
  const local = typeof recipientEmail === 'string' ? recipientEmail.split('@')[0] : ''
  return local || 'there'
}

/**
 * @param {{
 *   amountLabel: string | null
 *   intervalLabel: string | null
 *   interval?: string | null
 * }} pricing
 */
export function formatTrialConversionChargeLine(pricing) {
  const amount = pricing.amountLabel || '—'
  const per = formatIntervalPerPeriod(pricing.interval)
  if (pricing.intervalLabel) {
    return `${amount}${per} · ${pricing.intervalLabel}`
  }
  return `${amount}${per}`
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
 * }} options
 */
export function buildTrialConversionEmailHtml(options) {
  const appUrl = (options.appUrl || 'https://creatorexec.app').replace(/\/$/, '')
  const name = greetingName(options.recipientName, options.recipientEmail)
  const planName = options.planDisplayName || 'CreatorExec'
  const chargeLine = formatTrialConversionChargeLine(options)
  const privacyUrl = `${appUrl}/privacy`
  const termsUrl = `${appUrl}/terms`
  const appLink = `${appUrl}/app`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(TRIAL_CONVERSION_EMAIL_SUBJECT)}</title>
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
              <h1 style="margin:0;font-family:Georgia,'Playfair Display',Times,serif;font-size:32px;line-height:1.2;color:#1a4a3a;font-weight:700;">
                Your free trial has ended
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 0 28px;">
              <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#5c564c;">
                Hi ${escapeHtml(name)}, your trial is over and your subscription is now active. Here&rsquo;s a quick look at your first charge.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#faf7f2;border:1px solid #e8e0d4;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 6px 0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#1a4a3a;font-weight:600;">
                      First charge
                    </p>
                    <p style="margin:0;font-family:Georgia,'Playfair Display',Times,serif;font-size:22px;line-height:1.3;color:#1a1a1a;font-weight:700;">
                      ${escapeHtml(planName)}
                    </p>
                    <p style="margin:8px 0 0 0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#5c564c;">
                      ${escapeHtml(chargeLine)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 0 28px;">
              <p style="margin:0 0 8px 0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#1a4a3a;font-weight:600;">
                Keep going
              </p>
              <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#5c564c;">
                Upload a fresh commission report, build your next sprint, and keep retainers and income tracking in one place.
              </p>
            </td>
          </tr>
          <tr>
            <td align="left" style="padding:22px 28px 8px 28px;">
              <a href="${escapeHtml(appLink)}" style="display:inline-block;background-color:#1a4a3a;color:#ffffff;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:14px 22px;border:0;">
                Open CreatorExec →
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 24px 28px;border-top:1px solid #e8e0d4;">
              <p style="margin:0;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8276;">
                Questions about billing? Email
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
 * }} options
 */
export function buildTrialConversionEmailText(options) {
  const appUrl = (options.appUrl || 'https://creatorexec.app').replace(/\/$/, '')
  const name = greetingName(options.recipientName, options.recipientEmail)
  const planName = options.planDisplayName || 'CreatorExec'
  const chargeLine = formatTrialConversionChargeLine(options)

  return [
    'Your free trial has ended',
    '',
    `Hi ${name}, your trial is over and your subscription is now active.`,
    '',
    'First charge',
    planName,
    chargeLine,
    '',
    'Keep going',
    'Upload a fresh commission report, build your next sprint, and keep retainers and income tracking in one place.',
    `Open CreatorExec: ${appUrl}/app`,
    '',
    'Questions about billing? Email support@creatorexec.app',
    `Privacy: ${appUrl}/privacy`,
    `Terms: ${appUrl}/terms`,
  ].join('\n')
}

/**
 * @param {{
 *   apiKey?: string | null
 *   to: string
 *   html: string
 *   text: string
 *   subject?: string
 *   from?: string
 * }} options
 */
export async function sendTrialConversionEmailViaResend(options) {
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
      from: options.from ?? TRIAL_CONVERSION_EMAIL_FROM,
      to: [options.to],
      subject: options.subject ?? TRIAL_CONVERSION_EMAIL_SUBJECT,
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

export { formatMoneyFromStripe, formatBillingInterval }

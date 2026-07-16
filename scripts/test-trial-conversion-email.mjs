/**
 * Unit checks for trial-conversion detection + optional live Resend send.
 *
 *   node scripts/test-trial-conversion-email.mjs
 *   SEND_TRIAL_CONVERSION_EMAIL=1 RESEND_API_KEY=re_... node scripts/test-trial-conversion-email.mjs
 */
import { loadEnvFile } from '../server/env.mjs'
import {
  isTrialConversionInvoice,
  shouldAttemptTrialConversionEmail,
} from '../server/trialConversion.mjs'
import {
  TRIAL_CONVERSION_EMAIL_SUBJECT,
  buildTrialConversionEmailHtml,
  buildTrialConversionEmailText,
  formatTrialConversionChargeLine,
  sendTrialConversionEmailViaResend,
} from '../server/emails/trialConversionEmail.mjs'

loadEnvFile()

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const trialEnd = 1_700_000_000
const priceItem = {
  price: {
    id: 'price_preview_beta_monthly',
    unit_amount: 2500,
    currency: 'usd',
    recurring: { interval: 'month', interval_count: 1 },
  },
}

const conversionInvoice = {
  id: 'in_conversion',
  billing_reason: 'subscription_cycle',
  amount_paid: 2500,
  currency: 'usd',
  created: trialEnd + 60,
  period_start: trialEnd,
  period_end: trialEnd + 30 * 86_400,
  lines: { data: [{ period: { start: trialEnd, end: trialEnd + 30 * 86_400 } }] },
}

const conversionSubscription = {
  id: 'sub_conversion',
  status: 'active',
  trial_end: trialEnd,
  items: { data: [priceItem] },
}

function runDetectionTests() {
  assert(
    isTrialConversionInvoice(conversionInvoice, conversionSubscription),
    'Post-trial first charge should match',
  )

  assert(
    !isTrialConversionInvoice(
      { ...conversionInvoice, amount_paid: 0, billing_reason: 'subscription_create' },
      conversionSubscription,
    ),
    '$0 trial-create invoice should not match',
  )

  assert(
    !isTrialConversionInvoice(conversionInvoice, { ...conversionSubscription, trial_end: null }),
    'Never-trialed subscription should not match',
  )

  assert(
    !isTrialConversionInvoice(
      {
        ...conversionInvoice,
        period_start: trialEnd + 32 * 86_400,
        lines: {
          data: [{ period: { start: trialEnd + 32 * 86_400, end: trialEnd + 62 * 86_400 } }],
        },
      },
      conversionSubscription,
    ),
    'Later renewal invoice should not match',
  )

  assert(shouldAttemptTrialConversionEmail('invoice.paid'), 'invoice.paid should attempt send')
  assert(
    shouldAttemptTrialConversionEmail('invoice.payment_succeeded'),
    'invoice.payment_succeeded should attempt send',
  )
  assert(
    !shouldAttemptTrialConversionEmail('invoice.finalized'),
    'invoice.finalized should not attempt send',
  )

  console.log('PASS: trial conversion detection checks')
}

function runTemplateTests() {
  const html = buildTrialConversionEmailHtml({
    recipientName: "M'Lynn",
    recipientEmail: 'mlynnkohli@gmail.com',
    appUrl: 'https://www.creatorexec.app',
    planDisplayName: 'Beta — Monthly',
    amountLabel: '$25.00',
    intervalLabel: 'billed monthly',
    interval: 'month',
  })
  const text = buildTrialConversionEmailText({
    recipientName: "M'Lynn",
    recipientEmail: 'mlynnkohli@gmail.com',
    appUrl: 'https://www.creatorexec.app',
    planDisplayName: 'Beta — Monthly',
    amountLabel: '$25.00',
    intervalLabel: 'billed monthly',
    interval: 'month',
  })

  assert(html.includes('Your free trial has ended'), 'HTML should include headline')
  assert(html.includes('Beta — Monthly'), 'HTML should include plan name')
  assert(html.includes('$25.00'), 'HTML should include charged amount')
  assert(html.includes('support@creatorexec.app'), 'HTML should include support email')
  assert(html.includes('/privacy'), 'HTML should link privacy')
  assert(html.includes('/terms'), 'HTML should link terms')
  assert(text.includes('First charge'), 'Text should include charge section')
  assert(
    formatTrialConversionChargeLine({
      amountLabel: '$25.00',
      intervalLabel: 'billed monthly',
      interval: 'month',
    }).includes('$25.00/month'),
    'Charge line should include interval',
  )
  assert(TRIAL_CONVERSION_EMAIL_SUBJECT.includes('first charge'), 'Subject should mention first charge')

  console.log('PASS: trial conversion template checks')
}

async function maybeSendLive() {
  if (process.env.SEND_TRIAL_CONVERSION_EMAIL !== '1') return
  const to = process.env.TRIAL_CONVERSION_EMAIL_TO || process.env.WELCOME_EMAIL_TO
  if (!to) {
    throw new Error('Set TRIAL_CONVERSION_EMAIL_TO (or WELCOME_EMAIL_TO) for live send')
  }
  const html = buildTrialConversionEmailHtml({
    recipientName: 'Tester',
    recipientEmail: to,
    appUrl: process.env.APP_URL || 'https://www.creatorexec.app',
    planDisplayName: 'Beta — Monthly',
    amountLabel: '$25.00',
    intervalLabel: 'billed monthly',
    interval: 'month',
  })
  const text = buildTrialConversionEmailText({
    recipientName: 'Tester',
    recipientEmail: to,
    appUrl: process.env.APP_URL || 'https://www.creatorexec.app',
    planDisplayName: 'Beta — Monthly',
    amountLabel: '$25.00',
    intervalLabel: 'billed monthly',
    interval: 'month',
  })
  const result = await sendTrialConversionEmailViaResend({
    apiKey: process.env.RESEND_API_KEY,
    to,
    html,
    text,
  })
  if (!result.ok) throw new Error(result.error || 'send failed')
  console.log(`PASS: Resend trial conversion email sent to ${to} id=${result.id}`)
}

runDetectionTests()
runTemplateTests()
await maybeSendLive()
console.log('\nAll trial conversion email checks passed.')

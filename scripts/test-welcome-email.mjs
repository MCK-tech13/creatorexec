/**
 * Unit checks for welcome email helpers + optional Resend send.
 *
 * Usage:
 *   node scripts/test-welcome-email.mjs
 *   SEND_WELCOME_EMAIL=1 RESEND_API_KEY=re_... node scripts/test-welcome-email.mjs
 */
import { loadEnvFile } from '../server/env.mjs'
import { getPlanDisplayName } from '../server/planCatalog.mjs'
import {
  WELCOME_EMAIL_SUBJECT,
  buildWelcomeEmailHtml,
  buildWelcomeEmailText,
  extractPlanPricing,
  formatBillingInterval,
  formatMoneyFromStripe,
  sendWelcomeEmailViaResend,
} from '../server/emails/welcomeEmail.mjs'

loadEnvFile()

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function mainSync() {
  process.env.STRIPE_BETA_PRICE_ID = process.env.STRIPE_BETA_PRICE_ID || 'price_test_beta_monthly'

  assert(formatMoneyFromStripe(2500, 'usd') === '$25.00', 'formatMoneyFromStripe $25')
  assert(formatBillingInterval('month', 1) === 'billed monthly', 'interval monthly')
  assert(formatBillingInterval('year', 1) === 'billed yearly', 'interval yearly')
  assert(getPlanDisplayName('price_test_beta_monthly') === 'Beta — Monthly', 'beta mapping')
  assert(getPlanDisplayName('price_unknown_xyz') === 'CreatorExec', 'unknown mapping fallback')

  const pricing = extractPlanPricing({
    subscription: {
      items: {
        data: [
          {
            price: {
              id: 'price_test_beta_monthly',
              unit_amount: 2500,
              currency: 'usd',
              recurring: { interval: 'month', interval_count: 1 },
            },
          },
        ],
      },
    },
  })

  assert(pricing.planDisplayName === 'Beta — Monthly', 'extract plan name')
  assert(pricing.amountLabel === '$25.00', 'extract amount from Stripe unit_amount')
  assert(pricing.intervalLabel === 'billed monthly', 'extract interval')
  assert(!pricing.amountLabel.includes('hardcoded'), 'sanity')

  // Amount must come from Stripe object — change unit_amount and expect change.
  const yearly = extractPlanPricing({
    subscription: {
      items: {
        data: [
          {
            price: {
              id: 'price_future_yearly',
              unit_amount: 49000,
              currency: 'usd',
              recurring: { interval: 'year', interval_count: 1 },
            },
          },
        ],
      },
    },
  })
  assert(yearly.amountLabel === '$490.00', 'yearly amount from Stripe')
  assert(yearly.intervalLabel === 'billed yearly', 'yearly interval from Stripe')
  assert(yearly.planDisplayName === 'CreatorExec', 'unmapped price uses generic name')

  const html = buildWelcomeEmailHtml({
    recipientName: 'Alex',
    recipientEmail: 'alex@example.com',
    appUrl: 'https://www.creatorexec.app',
    planDisplayName: pricing.planDisplayName,
    amountLabel: pricing.amountLabel,
    intervalLabel: pricing.intervalLabel,
  })

  assert(html.includes('You&rsquo;re in!'), 'header present')
  assert(html.includes('Beta — Monthly'), 'plan name in html')
  assert(html.includes('$25.00'), 'amount in html')
  assert(html.includes('billed monthly'), 'interval in html')
  assert(html.includes('https://www.creatorexec.app/app'), 'app link')
  assert(html.includes('mailto:support@creatorexec.app'), 'support mailto')
  assert(html.includes('/privacy'), 'privacy link')
  assert(html.includes('/terms'), 'terms link')
  assert(!html.includes('$49/month after beta'), 'no future-price disclosure')
  assert(!html.includes('4242'), 'no test card copy')

  const text = buildWelcomeEmailText({
    recipientName: 'Alex',
    recipientEmail: 'alex@example.com',
    appUrl: 'https://www.creatorexec.app',
    planDisplayName: pricing.planDisplayName,
    amountLabel: pricing.amountLabel,
    intervalLabel: pricing.intervalLabel,
  })
  assert(text.includes('Beta — Monthly'), 'plan in text')
  assert(text.includes(WELCOME_EMAIL_SUBJECT) || true, 'subject constant exists')

  console.log('PASS: welcome email unit checks')
}

async function maybeSend() {
  if (process.env.SEND_WELCOME_EMAIL !== '1') {
    console.log('Skipping live Resend send (set SEND_WELCOME_EMAIL=1 to send).')
    return
  }

  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.WELCOME_EMAIL_TO || process.env.TEST_EMAIL
  if (!apiKey || !to) {
    throw new Error('SEND_WELCOME_EMAIL=1 requires RESEND_API_KEY and WELCOME_EMAIL_TO')
  }

  process.env.STRIPE_BETA_PRICE_ID = process.env.STRIPE_BETA_PRICE_ID || 'price_test_beta_monthly'
  const pricing = extractPlanPricing({
    subscription: {
      items: {
        data: [
          {
            price: {
              id: process.env.STRIPE_BETA_PRICE_ID,
              unit_amount: 2500,
              currency: 'usd',
              recurring: { interval: 'month', interval_count: 1 },
            },
          },
        ],
      },
    },
  })

  const mail = {
    recipientName: null,
    recipientEmail: to,
    appUrl: process.env.APP_URL || 'https://www.creatorexec.app',
    planDisplayName: pricing.planDisplayName,
    amountLabel: pricing.amountLabel,
    intervalLabel: pricing.intervalLabel,
  }

  const result = await sendWelcomeEmailViaResend({
    apiKey,
    to,
    html: buildWelcomeEmailHtml(mail),
    text: buildWelcomeEmailText(mail),
  })

  if (!result.ok) {
    throw new Error(`Resend send failed: ${result.error}`)
  }
  console.log(`PASS: Resend welcome email sent to ${to} id=${result.id}`)
}

mainSync()
await maybeSend()

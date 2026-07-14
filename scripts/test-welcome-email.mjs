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
  formatPlanSummaryLine,
  sendWelcomeEmailViaResend,
  welcomeIntroSentence,
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

  const paidPricing = extractPlanPricing({
    subscription: {
      status: 'active',
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

  assert(paidPricing.isTrialing === false, 'paid is not trialing')
  assert(paidPricing.planDisplayName === 'Beta — Monthly', 'extract plan name')
  assert(paidPricing.amountLabel === '$25.00', 'extract amount from Stripe unit_amount')
  assert(paidPricing.intervalLabel === 'billed monthly', 'extract interval')
  assert(
    formatPlanSummaryLine(paidPricing) === '$25.00 · billed monthly',
    'paid plan summary line',
  )
  assert(
    welcomeIntroSentence({ isTrialing: false }).includes('subscription is active'),
    'paid intro',
  )

  const trialStart = 1_720_000_000
  const trialEnd = trialStart + 7 * 86_400
  const trialPricing = extractPlanPricing({
    subscription: {
      status: 'trialing',
      trial_start: trialStart,
      trial_end: trialEnd,
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

  assert(trialPricing.isTrialing === true, 'trialing detected')
  assert(trialPricing.trialDays === 7, 'trial days from Stripe timestamps')
  assert(
    formatPlanSummaryLine(trialPricing) === 'Free for 7 days, then $25.00/month',
    'trial plan summary line',
  )
  assert(
    welcomeIntroSentence({ isTrialing: true, trialDays: 7 }).includes(
      '7-day free trial has started',
    ),
    'trial intro',
  )

  const paidHtml = buildWelcomeEmailHtml({
    recipientName: 'Alex',
    recipientEmail: 'alex@example.com',
    appUrl: 'https://www.creatorexec.app',
    planDisplayName: paidPricing.planDisplayName,
    amountLabel: paidPricing.amountLabel,
    intervalLabel: paidPricing.intervalLabel,
    interval: paidPricing.interval,
    isTrialing: false,
  })

  assert(paidHtml.includes('your subscription is active.'), 'paid body copy')
  assert(paidHtml.includes('$25.00 · billed monthly'), 'paid plan box')
  assert(!paidHtml.includes('Free for 7 days'), 'paid html has no trial line')

  const trialHtml = buildWelcomeEmailHtml({
    recipientName: 'Alex',
    recipientEmail: 'alex@example.com',
    appUrl: 'https://www.creatorexec.app',
    planDisplayName: trialPricing.planDisplayName,
    amountLabel: trialPricing.amountLabel,
    intervalLabel: trialPricing.intervalLabel,
    interval: trialPricing.interval,
    isTrialing: true,
    trialDays: 7,
  })

  assert(trialHtml.includes('your 7-day free trial has started.'), 'trial body copy')
  assert(trialHtml.includes('Free for 7 days, then $25.00/month'), 'trial plan box')
  assert(!trialHtml.includes('your subscription is active.'), 'trial html not paid wording')
  assert(trialHtml.includes('https://www.creatorexec.app/app'), 'app link')
  assert(trialHtml.includes('mailto:support@creatorexec.app'), 'support mailto')

  const trialText = buildWelcomeEmailText({
    recipientName: 'Alex',
    recipientEmail: 'alex@example.com',
    appUrl: 'https://www.creatorexec.app',
    planDisplayName: trialPricing.planDisplayName,
    amountLabel: trialPricing.amountLabel,
    intervalLabel: trialPricing.intervalLabel,
    interval: trialPricing.interval,
    isTrialing: true,
    trialDays: 7,
  })
  assert(trialText.includes('7-day free trial has started'), 'trial text intro')
  assert(trialText.includes('Free for 7 days, then $25.00/month'), 'trial text plan')
  assert(Boolean(WELCOME_EMAIL_SUBJECT), 'subject constant exists')

  console.log('PASS: welcome email unit checks (trial + paid)')
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
  const now = Math.floor(Date.now() / 1000)
  const pricing = extractPlanPricing({
    subscription: {
      status: 'trialing',
      trial_start: now,
      trial_end: now + 7 * 86_400,
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
    interval: pricing.interval,
    isTrialing: pricing.isTrialing,
    trialDays: pricing.trialDays,
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

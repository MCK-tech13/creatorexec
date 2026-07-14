/**
 * Generate local HTML previews of the welcome email (trial + paid).
 *
 * Usage:
 *   node scripts/preview-welcome-email.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvFile } from '../server/env.mjs'
import { getPlanDisplayNameCatalog } from '../server/planCatalog.mjs'
import {
  WELCOME_EMAIL_SUBJECT,
  buildWelcomeEmailHtml,
  extractPlanPricing,
  formatPlanSummaryLine,
  welcomeIntroSentence,
} from '../server/emails/welcomeEmail.mjs'

loadEnvFile()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = process.env.WELCOME_EMAIL_PREVIEW_DIR || '/opt/cursor/artifacts'
mkdirSync(outDir, { recursive: true })

const betaPriceId = process.env.STRIPE_BETA_PRICE_ID?.trim() || 'price_preview_beta_monthly'
const now = Math.floor(Date.now() / 1000)

function writePreview(label, subscription) {
  const pricing = extractPlanPricing({ subscription })
  const html = buildWelcomeEmailHtml({
    recipientName: "M'Lynn",
    recipientEmail: 'mlynnkohli@gmail.com',
    appUrl: process.env.APP_URL || 'https://www.creatorexec.app',
    planDisplayName: pricing.planDisplayName,
    amountLabel: pricing.amountLabel,
    intervalLabel: pricing.intervalLabel,
    interval: pricing.interval,
    isTrialing: pricing.isTrialing,
    trialDays: pricing.trialDays,
  })
  const outPath = path.join(outDir, `welcome-email-preview-${label}.html`)
  writeFileSync(outPath, html, 'utf8')
  console.log(`[${label}]`)
  console.log(`  intro: Hi M'Lynn, ${welcomeIntroSentence(pricing)}`)
  console.log(`  plan:  ${pricing.planDisplayName}`)
  console.log(`  line:  ${formatPlanSummaryLine(pricing)}`)
  console.log(`  wrote: ${outPath}`)
  console.log('')
  return outPath
}

const priceItem = {
  price: {
    id: betaPriceId,
    unit_amount: 2500,
    currency: 'usd',
    recurring: { interval: 'month', interval_count: 1 },
  },
}

console.log('Welcome email preview')
console.log('='.repeat(60))
console.log(`Subject: ${WELCOME_EMAIL_SUBJECT}`)
console.log(`From: CreatorExec <support@creatorexec.app>`)
console.log('Catalog:', JSON.stringify(getPlanDisplayNameCatalog(), null, 2))
console.log('')

writePreview('trial', {
  id: 'sub_preview_trial',
  status: 'trialing',
  trial_start: now,
  trial_end: now + 7 * 86_400,
  items: { data: [priceItem] },
})

writePreview('paid', {
  id: 'sub_preview_paid',
  status: 'active',
  items: { data: [priceItem] },
})

writeFileSync(
  path.join(root, 'tmp-welcome-email-preview.html'),
  buildWelcomeEmailHtml({
    recipientName: "M'Lynn",
    recipientEmail: 'mlynnkohli@gmail.com',
    appUrl: 'https://www.creatorexec.app',
    ...extractPlanPricing({
      subscription: {
        status: 'trialing',
        trial_start: now,
        trial_end: now + 7 * 86_400,
        items: { data: [priceItem] },
      },
    }),
  }),
  'utf8',
)

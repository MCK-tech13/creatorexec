/**
 * Generate a local HTML preview of the welcome email (no Resend send).
 *
 * Usage:
 *   node scripts/preview-welcome-email.mjs
 *   STRIPE_BETA_PRICE_ID=price_test_beta node scripts/preview-welcome-email.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvFile } from '../server/env.mjs'
import { getPlanDisplayName, getPlanDisplayNameCatalog } from '../server/planCatalog.mjs'
import {
  WELCOME_EMAIL_SUBJECT,
  buildWelcomeEmailHtml,
  extractPlanPricing,
} from '../server/emails/welcomeEmail.mjs'

loadEnvFile()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = process.env.WELCOME_EMAIL_PREVIEW_DIR || '/opt/cursor/artifacts'
mkdirSync(outDir, { recursive: true })

const betaPriceId = process.env.STRIPE_BETA_PRICE_ID?.trim() || 'price_preview_beta_monthly'

const mockSubscription = {
  id: 'sub_preview',
  status: 'active',
  items: {
    data: [
      {
        price: {
          id: betaPriceId,
          unit_amount: 2500,
          currency: 'usd',
          recurring: { interval: 'month', interval_count: 1 },
        },
      },
    ],
  },
}

const pricing = extractPlanPricing({ subscription: mockSubscription })
const html = buildWelcomeEmailHtml({
  recipientName: 'M\'Lynn',
  recipientEmail: 'mlynnkohli@gmail.com',
  appUrl: process.env.APP_URL || 'https://www.creatorexec.app',
  planDisplayName: pricing.planDisplayName,
  amountLabel: pricing.amountLabel,
  intervalLabel: pricing.intervalLabel,
})

const outPath = path.join(outDir, 'welcome-email-preview.html')
writeFileSync(outPath, html, 'utf8')

console.log('Welcome email preview')
console.log('='.repeat(60))
console.log(`Subject: ${WELCOME_EMAIL_SUBJECT}`)
console.log(`From: CreatorExec <support@creatorexec.app>`)
console.log('')
console.log('price_id → display name mapping:')
console.log(JSON.stringify(getPlanDisplayNameCatalog(), null, 2))
console.log('')
console.log('Resolved plan for preview:')
console.log(
  JSON.stringify(
    {
      priceId: pricing.priceId,
      planDisplayName: getPlanDisplayName(pricing.priceId),
      amountLabel: pricing.amountLabel,
      intervalLabel: pricing.intervalLabel,
    },
    null,
    2,
  ),
)
console.log('')
console.log(`Wrote HTML preview: ${outPath}`)
console.log(`Repo copy: ${path.join(root, 'tmp-welcome-email-preview.html')} (optional)`)
writeFileSync(path.join(root, 'tmp-welcome-email-preview.html'), html, 'utf8')

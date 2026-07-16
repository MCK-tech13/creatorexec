/**
 * Generate trial-conversion email HTML preview + screenshot.
 *
 *   node scripts/preview-trial-conversion-email.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { loadEnvFile } from '../server/env.mjs'
import {
  TRIAL_CONVERSION_EMAIL_SUBJECT,
  buildTrialConversionEmailHtml,
} from '../server/emails/trialConversionEmail.mjs'

loadEnvFile()

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifacts = process.env.TRIAL_CONVERSION_EMAIL_PREVIEW_DIR || '/opt/cursor/artifacts'
mkdirSync(artifacts, { recursive: true })

const html = buildTrialConversionEmailHtml({
  recipientName: "M'Lynn",
  recipientEmail: 'mlynnkohli@gmail.com',
  appUrl: process.env.APP_URL || 'https://www.creatorexec.app',
  planDisplayName: 'Beta — Monthly',
  amountLabel: '$25.00',
  intervalLabel: 'billed monthly',
  interval: 'month',
})

const htmlPath = path.join(artifacts, 'trial-conversion-email-preview.html')
writeFileSync(htmlPath, html, 'utf8')
writeFileSync(path.join(root, 'tmp-trial-conversion-email-preview.html'), html, 'utf8')

console.log('Trial conversion email preview')
console.log('='.repeat(60))
console.log(`Subject: ${TRIAL_CONVERSION_EMAIL_SUBJECT}`)
console.log(`From: CreatorExec <support@creatorexec.app>`)
console.log(`Wrote: ${htmlPath}`)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 1100 } })
await page.goto(`file://${htmlPath}`)
await page.screenshot({
  path: path.join(artifacts, 'trial-conversion-email.png'),
  fullPage: true,
})
await browser.close()
console.log(`Screenshot: ${path.join(artifacts, 'trial-conversion-email.png')}`)

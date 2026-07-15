/**
 * Generate upload-reminder email HTML + banner UI screenshots.
 * Usage: node scripts/preview-upload-reminder.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import {
  UPLOAD_REMINDER_EMAIL_SUBJECT,
  buildUploadReminderEmailHtml,
} from '../server/emails/uploadReminderEmail.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifacts = process.env.UPLOAD_REMINDER_PREVIEW_DIR || '/opt/cursor/artifacts'
mkdirSync(artifacts, { recursive: true })

const emailHtml = buildUploadReminderEmailHtml({
  recipientName: "M'Lynn",
  recipientEmail: 'mlynnkohli@gmail.com',
  appUrl: 'https://www.creatorexec.app',
  sprintDays: 7,
  daysSinceUpload: 11,
})

const emailPath = path.join(artifacts, 'upload-reminder-email-preview.html')
writeFileSync(emailPath, emailHtml, 'utf8')
writeFileSync(path.join(root, 'tmp-upload-reminder-email-preview.html'), emailHtml, 'utf8')

const bannerHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Upload reminder banner</title>
  <style>
    :root {
      --ink: #1c1917;
      --stone: #78716c;
      --cream: #faf7f2;
      --border: #e7e0d5;
      --emerald: #1f6b5a;
      --terracotta-tint: #f8ebe6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: var(--cream);
      color: var(--ink);
      padding: 32px;
    }
    .wrap { max-width: 880px; margin: 0 auto; }
    h1 { font-family: Georgia, "Playfair Display", serif; font-size: 28px; margin: 0 0 8px; }
    .sub { color: var(--stone); margin-bottom: 24px; font-size: 14px; }
    .banner {
      border: 1px solid var(--border);
      background: #fff;
      padding: 16px 20px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .icon {
      width: 32px; height: 32px; border: 1px solid var(--border);
      background: var(--terracotta-tint); color: var(--emerald);
      display: inline-flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .title { font-size: 15px; font-weight: 600; margin: 0; }
    .detail { margin: 6px 0 0; color: var(--stone); font-size: 13px; }
    .actions { margin-top: 12px; display: flex; gap: 12px; align-items: center; }
    .cta {
      background: var(--emerald); color: #fff; border: 0;
      padding: 10px 14px; font-size: 13px; font-weight: 600;
    }
    .dismiss { background: transparent; border: 0; color: var(--stone); font-size: 13px; text-decoration: underline; }
    .x { margin-left: auto; color: var(--stone); border: 0; background: transparent; font-size: 18px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>In-app upload reminder</h1>
    <p class="sub">Quiet dismissible banner on Home and Sprint — shown when days since last CSV upload exceed the user’s sprint length.</p>
    <div class="banner" role="status">
      <span class="icon">⇪</span>
      <div style="flex:1">
        <p class="title">It’s been a while since your last upload — ready to start a new sprint?</p>
        <p class="detail">11 days since your last commission report (your sprint is 7 days).</p>
        <div class="actions">
          <button class="cta" type="button">Upload new report</button>
          <button class="dismiss" type="button">Dismiss</button>
        </div>
      </div>
      <button class="x" type="button" aria-label="Dismiss">×</button>
    </div>
  </div>
</body>
</html>`

const bannerPath = path.join(artifacts, 'upload-reminder-banner-preview.html')
writeFileSync(bannerPath, bannerHtml, 'utf8')

async function screenshot(name, htmlPath) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
  await page.goto(`file://${htmlPath}`)
  await page.screenshot({
    path: path.join(artifacts, `${name}.png`),
    fullPage: true,
  })
  await browser.close()
  console.log(`Wrote ${path.join(artifacts, `${name}.png`)}`)
}

console.log('Upload reminder preview')
console.log('='.repeat(60))
console.log(`Subject: ${UPLOAD_REMINDER_EMAIL_SUBJECT}`)
console.log(`Email HTML: ${emailPath}`)
console.log(`Banner HTML: ${bannerPath}`)
console.log('')

await screenshot('upload-reminder-email', emailPath)
await screenshot('upload-reminder-banner', bannerPath)

/**
 * Renders static HTML previews of Product Scout OCR UI states for review screenshots.
 * Usage: node scripts/render-product-scout-ocr-ui.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const artifacts = '/opt/cursor/artifacts'
mkdirSync(artifacts, { recursive: true })

function pageHtml(state) {
  const reading = state === 'reading'
  const error = state === 'error'
  const low = state === 'prefilled-low'
  const prefilled = state === 'prefilled-high' || low

  const values = prefilled
    ? {
        orders: '24.1K',
        ctr: '3.5',
        creators: '8.8K',
        atc: '74.1K',
      }
    : { orders: '', ctr: '', creators: '', atc: '' }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Product Scout OCR — ${state}</title>
  <style>
    :root {
      --ink: #1c1917;
      --stone: #78716c;
      --cream: #faf7f2;
      --border: #e7e0d5;
      --terracotta: #c45c3e;
      --terracotta-tint: #f8ebe6;
      --emerald: #1f6b5a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, serif;
      background: linear-gradient(180deg, #f4efe6 0%, #faf7f2 40%, #f7f3ec 100%);
      color: var(--ink);
      padding: 32px;
    }
    .wrap { max-width: 980px; margin: 0 auto; }
    h1 { font-size: 36px; margin: 0 0 8px; }
    .sub { font-family: ui-sans-serif, system-ui, sans-serif; color: var(--stone); margin-bottom: 28px; }
    .label { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--stone); margin-bottom: 8px; }
    .card {
      border: 1px solid var(--border);
      background: rgba(255,255,255,0.72);
      padding: 28px;
    }
    .row { display: flex; justify-content: space-between; gap: 16px; align-items: end; margin-bottom: 18px; }
    .btn {
      font-family: ui-sans-serif, system-ui, sans-serif;
      border: 1px solid var(--ink);
      background: transparent;
      padding: 10px 16px;
      display: inline-flex;
      gap: 8px;
      align-items: center;
      font-size: 14px;
    }
    .btn[disabled] { opacity: 0.55; }
    input {
      width: 100%;
      border: 1px solid var(--border);
      background: #fff;
      padding: 12px;
      font-size: 15px;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    fieldset { border: 1px solid var(--border); padding: 16px; margin: 0; }
    legend { font-family: ui-sans-serif, system-ui, sans-serif; font-weight: 600; padding: 0 6px; }
    .hint { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; color: var(--stone); margin: 0 0 12px; }
    .banner {
      font-family: ui-sans-serif, system-ui, sans-serif;
      border: 1px solid var(--border);
      background: rgba(255,255,255,0.8);
      padding: 12px 14px;
      margin-bottom: 16px;
      font-size: 14px;
    }
    .warn { border-color: rgba(196,92,62,0.4); background: var(--terracotta-tint); }
    .spin {
      width: 14px; height: 14px; border: 2px solid var(--stone); border-top-color: transparent;
      border-radius: 50%; display: inline-block; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Product Scout</h1>
    <p class="sub">Screenshot upload preview — state: <strong>${state}</strong></p>
    <div class="card">
      <div class="label">Product name</div>
      <input value="${prefilled ? 'Vitamin C serum — GlowLab' : ''}" placeholder="e.g. Vitamin C serum — GlowLab" />
      <div style="height: 24px"></div>
      <div class="row">
        <div>
          <div class="label">TikTok Product trends</div>
          <p class="hint" style="max-width: 520px">Enter the 30-day value and delta exactly as shown — or upload a screenshot to pre-fill the values.</p>
        </div>
        <button class="btn" ${reading ? 'disabled' : ''}>
          ${reading ? '<span class="spin"></span> Reading…' : 'Upload screenshot'}
        </button>
      </div>
      ${
        reading
          ? '<div class="banner" role="status">Reading your screenshot…<div class="hint" style="margin-top:6px">tiktok-trends.png</div></div>'
          : ''
      }
      ${
        error
          ? `<div class="banner warn" role="alert"><strong>Couldn't read that screenshot</strong><div style="margin-top:6px;color:var(--stone)">Claude API error (429). You can still enter the numbers manually below — nothing was submitted.</div></div>`
          : ''
      }
      ${
        low
          ? `<div class="banner warn" role="status">Double-check these numbers — the screenshot was hard to read. Values are pre-filled only; they won't be scored until you review and save.</div>`
          : ''
      }
      ${
        state === 'prefilled-high'
          ? `<div class="hint">Pre-filled from screenshot (high confidence). Review the values — especially deltas — then save when they look right.</div>`
          : ''
      }
      <div class="grid">
        ${[
          ['Orders', values.orders, '+3.6K'],
          ['CTR', values.ctr, '-0.5'],
          ['Number of creators', values.creators, '+1.1K'],
          ['Add-to-cart users', values.atc, '+13.2K'],
        ]
          .map(
            ([label, value, delta]) => `
          <fieldset>
            <legend>${label}</legend>
            <p class="hint">From TikTok Product trends</p>
            <div class="grid">
              <div><div class="label">Value</div><input value="${value}" placeholder="—" ${reading ? 'disabled' : ''} /></div>
              <div><div class="label">Delta</div><input value="" placeholder="${delta}" ${reading ? 'disabled' : ''} /></div>
            </div>
          </fieldset>`,
          )
          .join('')}
      </div>
    </div>
  </div>
</body>
</html>`
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } })
  const states = ['idle-upload', 'reading', 'prefilled-high', 'prefilled-low', 'error']

  for (const state of states) {
    const htmlPath = path.join(artifacts, `product-scout-ocr-ui-${state}.html`)
    writeFileSync(htmlPath, pageHtml(state))
    await page.goto(`file://${htmlPath}`)
    const shot = path.join(artifacts, `product-scout-ocr-ui-${state}.png`)
    await page.screenshot({ path: shot, fullPage: true })
    console.log(`wrote ${shot}`)
  }

  await browser.close()
}

main().catch(async (error) => {
  console.error(error)
  // Fallback without playwright: write HTML only
  for (const state of ['idle-upload', 'reading', 'prefilled-high', 'prefilled-low', 'error']) {
    writeFileSync(path.join(artifacts, `product-scout-ocr-ui-${state}.html`), pageHtml(state))
  }
  process.exit(1)
})

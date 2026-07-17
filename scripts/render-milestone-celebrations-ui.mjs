/**
 * Renders static HTML screenshots of milestone celebration UI.
 * Usage: node scripts/render-milestone-celebrations-ui.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const artifacts = '/opt/cursor/artifacts'
mkdirSync(artifacts, { recursive: true })

const sharedStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:wght@700&display=swap');
  :root {
    --ink: #1a1a1a;
    --stone: #8a8a8a;
    --cream: #faf7f2;
    --border: #e8e8e8;
    --emerald: #1a4a3a;
    --terracotta: #c1633f;
    --terracotta-tint: #fdf4f0;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
    background: var(--cream);
    color: var(--ink);
  }
  .font-display { font-family: "Playfair Display", Georgia, serif; }
  .btn-primary {
    border: 0;
    border-radius: 0;
    background: #1a4a3a;
    color: #fff;
    font-family: "DM Sans", sans-serif;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-size: 0.8125rem;
    cursor: pointer;
  }
  @keyframes celebrationToastEnter {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes celebrationCardEnter {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes celebrationConfettiBurst {
    0% { opacity: 0; transform: translateY(8px) scale(0.6) rotate(0deg); }
    20% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-36px) scale(1) rotate(140deg); }
  }
  .celebration-toast-enter { animation: celebrationToastEnter 0.35s ease-out both; }
  .celebration-card-enter { animation: celebrationCardEnter 0.4s ease-out both; }
  .celebration-confetti {
    position: absolute;
    bottom: 10px;
    width: 6px;
    height: 10px;
    border-radius: 1px;
    opacity: 0;
    animation: celebrationConfettiBurst 0.9s ease-out both;
  }
`

function toastHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Anchor promotion toast</title>
  <style>
    ${sharedStyles}
    .stage {
      min-height: 100vh;
      padding: 48px;
      background:
        linear-gradient(180deg, rgba(250,247,242,0.92), rgba(250,247,242,0.92)),
        repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(232,232,232,0.35) 24px, rgba(232,232,232,0.35) 25px);
    }
    .hint { color: var(--stone); font-size: 14px; margin-bottom: 24px; max-width: 420px; }
    .fake-table {
      max-width: 640px;
      border: 1px solid var(--border);
      background: #fff;
      padding: 24px;
    }
    .toast {
      position: fixed;
      right: 24px;
      bottom: 24px;
      width: 22rem;
      border: 1px solid rgba(26,74,58,0.25);
      background: var(--cream);
      padding: 16px 20px;
      box-shadow: 0 12px 40px rgba(26,26,26,0.08);
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div class="stage">
    <h1 class="font-display" style="font-size:36px;margin:0 0 8px;">Product dashboard</h1>
    <p class="hint">Background context only — toast appears bottom-right after a product is promoted to Anchor.</p>
    <div class="fake-table">
      <p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:var(--stone);">Products</p>
      <p style="margin:16px 0 0;font-weight:600;">Glow Serum <span style="margin-left:8px;background:#0f3328;color:#eef2ee;padding:3px 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">Anchor</span></p>
    </div>
    <div class="toast celebration-toast-enter" role="status">
      <div style="position:absolute;inset:0;pointer-events:none;" aria-hidden="true">
        <span class="celebration-confetti" style="left:12%;background:#1a4a3a;animation-delay:0ms;"></span>
        <span class="celebration-confetti" style="left:30%;background:#c1633f;animation-delay:45ms;"></span>
        <span class="celebration-confetti" style="left:48%;background:#faf7f2;animation-delay:90ms;"></span>
        <span class="celebration-confetti" style="left:66%;background:#245a48;animation-delay:135ms;"></span>
        <span class="celebration-confetti" style="left:84%;background:#d4846a;animation-delay:180ms;"></span>
      </div>
      <p class="font-display" style="position:relative;margin:0;font-size:20px;line-height:1.3;">
        🎉 Glow Serum just hit Anchor tier!
      </p>
      <p style="position:relative;margin:6px 0 0;font-size:12px;color:var(--stone);">Keep the momentum going.</p>
    </div>
  </div>
</body>
</html>`
}

function firstSprintHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>First sprint celebration</title>
  <style>
    ${sharedStyles}
    .backdrop {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(26,26,26,0.25);
    }
    .card {
      width: 100%;
      max-width: 28rem;
      border: 1px solid var(--border);
      background: var(--cream);
      box-shadow: 0 20px 60px rgba(26,26,26,0.12);
    }
    .header {
      border-bottom: 1px solid rgba(26,74,58,0.2);
      background: var(--terracotta-tint);
      padding: 28px 32px;
    }
    .body { padding: 24px 32px 28px; }
  </style>
</head>
<body>
  <div class="backdrop">
    <div class="card celebration-card-enter" role="dialog" aria-modal="true">
      <div class="header">
        <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--emerald);">Milestone</p>
        <h2 class="font-display" style="margin:8px 0 0;font-size:30px;line-height:1.15;">You completed your first sprint 🎉</h2>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:var(--stone);">
          That's a real start — you showed up, filmed, and gave your products a fair test.
        </p>
      </div>
      <div class="body">
        <p style="margin:0;font-size:14px;">24 videos filmed, 8 products tested.</p>
        <button class="btn-primary" style="margin-top:20px;width:100%;padding:12px 24px;">Continue</button>
      </div>
    </div>
  </div>
</body>
</html>`
}

async function shot(name, html, viewport) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport })
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const out = path.join(artifacts, name)
  await page.screenshot({ path: out, fullPage: true })
  await browser.close()
  writeFileSync(path.join(artifacts, name.replace(/\.png$/, '.html')), html)
  console.log('Wrote', out)
}

await shot('milestone-anchor-toast.png', toastHtml(), { width: 1100, height: 700 })
await shot('milestone-first-sprint.png', firstSprintHtml(), { width: 1100, height: 760 })
console.log('Done.')

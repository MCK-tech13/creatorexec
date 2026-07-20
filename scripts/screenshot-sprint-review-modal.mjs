/**
 * Desktop screenshot of SprintReviewModal height fix.
 * Run: node scripts/screenshot-sprint-review-modal.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const outDir = '/opt/cursor/artifacts/screenshots'
await mkdir(outDir, { recursive: true })

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700&family=Source+Sans+3:wght@400;500;600&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Source Sans 3', sans-serif; background: #f3efe6; color: #1a1a1a; }
  .label { position: absolute; top: 12px; left: 16px; z-index: 60; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #8a7f72; }
  .overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: rgba(26,26,26,.4); padding: 24px; }
  .panel { display: flex; flex-direction: column; width: 100%; max-width: 42rem; max-height: min(90dvh, 52rem); border: 1px solid #e8e0d4; background: #f7f2ea; }
  .header { flex-shrink: 0; border-bottom: 1px solid #1f4d3a; background: #f3e6d8; padding: 24px 32px; }
  .eyebrow { font-size: 11px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; color: #1f4d3a; margin: 0; }
  h2 { font-family: Fraunces, serif; font-size: 30px; font-weight: 700; margin: 8px 0 0; }
  .sub { margin: 8px 0 0; color: #8a7f72; font-size: 16px; }
  .body { flex: 1; min-height: 0; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; }
  .section { border: 1px solid #e8e0d4; background: #fff; }
  .section h3 { margin: 0; border-bottom: 1px solid #e8e0d4; padding: 12px 24px; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #8a7f72; font-weight: 500; }
  .section .inner { padding: 16px 24px; }
  .stat { font-family: Fraunces, serif; font-size: 30px; font-weight: 700; color: #1f4d3a; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-top: 1px solid #e8e0d4; font-size: 15px; }
  .row:first-child { border-top: 0; padding-top: 0; }
  .badge { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; background: #1f4d3a; color: #fff; padding: 4px 8px; }
  .footer { flex-shrink: 0; border-top: 1px solid #e8e0d4; background: #f7f2ea; padding: 20px 24px; }
  .btn { width: 100%; background: #1f4d3a; color: #fff; border: 0; padding: 14px; font-size: 14px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
  .note { position: absolute; bottom: 16px; left: 16px; z-index: 60; font-size: 12px; color: #8a7f72; max-width: 360px; background: rgba(255,255,255,.9); padding: 8px 10px; border: 1px solid #e8e0d4; }
</style>
</head>
<body>
  <p class="label">Desktop · Sprint review modal · max-height + body scroll</p>
  <div class="overlay">
    <div class="panel">
      <div class="header">
        <p class="eyebrow">Sprint complete</p>
        <h2>What happened this sprint</h2>
        <p class="sub">A quick recap before you start your next sprint.</p>
      </div>
      <div class="body">
        <div class="section">
          <h3>Commission</h3>
          <div class="inner">
            <p style="margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8a7f72">This sprint</p>
            <p class="stat">$1,240</p>
            <p style="margin:0;color:#8a7f72;font-size:14px">Previous: $980</p>
          </div>
        </div>
        <div class="section" style="border-color:rgba(31,77,58,.3);background:#e8f0ea">
          <div class="inner">
            <p class="eyebrow">Top performer</p>
            <p style="font-family:Fraunces,serif;font-size:22px;font-weight:700;margin:8px 0 0">Hydrating Face Serum</p>
            <p style="margin:8px 0 0;color:#8a7f72;font-size:14px">$420 commission this sprint</p>
          </div>
        </div>
        <div class="section">
          <h3>Tier movement</h3>
          <div class="inner">
            ${['Peptide Neck Cream','Glow Mist','Night Oil','Vitamin C Drops','Lip Butter'].map((n,i)=>`
              <div class="row"><span>${n}</span><span><span class="badge">${i%2?'Test':'Rising'}</span> → <span class="badge">${i%2?'Rising':'Anchor'}</span></span></div>
            `).join('')}
          </div>
        </div>
        <div class="section">
          <h3>Trials completed</h3>
          <div class="inner">
            ${['Sample Serum A','Favorite B','Launch C','Gifted D'].map(n=>`
              <div class="row"><span>${n}</span><span class="badge">Rising</span></div>
            `).join('')}
          </div>
        </div>
        <div class="section">
          <h3>Consider cutting</h3>
          <div class="inner">
            <p style="margin:0 0 12px;color:#8a7f72;font-size:14px">These Test and Rising products have not moved tiers for two consecutive sprints.</p>
            ${['Stalled Product 1','Stalled Product 2','Stalled Product 3'].map(n=>`
              <div class="row"><span>${n}</span><span class="badge">Test</span></div>
            `).join('')}
          </div>
        </div>
        <div class="section" style="border-color:rgba(196,122,78,.4);background:#f3e6d8">
          <div class="inner">
            <p style="margin:0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a7f72">Still in progress</p>
            <p style="font-family:Fraunces,serif;font-size:28px;font-weight:700;margin:8px 0 0">4</p>
            <p style="margin:4px 0 0;color:#8a7f72;font-size:14px">products still mid-trial heading into next sprint</p>
          </div>
        </div>
      </div>
      <div class="footer">
        <button class="btn" type="button">Continue to next sprint</button>
      </div>
    </div>
  </div>
  <p class="note">Header + Continue stay fixed. Body scrolls inside max-height: min(90dvh, 52rem).</p>
</body>
</html>`

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  headless: true,
})

// Desktop
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await desktop.setContent(html, { waitUntil: 'networkidle' })
await desktop.screenshot({
  path: `${outDir}/sprint-review-modal-desktop.png`,
  type: 'png',
  fullPage: false,
})
console.log('wrote', `${outDir}/sprint-review-modal-desktop.png`)

// Mobile sanity (same structure)
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
await mobile.setContent(html, { waitUntil: 'networkidle' })
await mobile.screenshot({
  path: `${outDir}/sprint-review-modal-mobile.png`,
  type: 'png',
  fullPage: false,
})
console.log('wrote', `${outDir}/sprint-review-modal-mobile.png`)

await browser.close()
console.log('done')

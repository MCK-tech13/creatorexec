/**
 * Screenshots of Stage 2 catalog-add entry points (upload, momentum, empty, dashboard).
 * Run: node scripts/screenshot-catalog-entry-points.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const outDir = '/opt/cursor/artifacts/screenshots'

const css = String.raw`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap');

  :root {
    --font-body: "DM Sans", ui-sans-serif, system-ui, sans-serif;
    --font-display: "Fraunces", Georgia, serif;
    --color-cream: #faf7f2;
    --color-white: #ffffff;
    --color-ink: #1a1a1a;
    --color-stone: #8a8a8a;
    --color-border-warm: #e8e8e8;
    --color-emerald: #1a4a3a;
    --color-terracotta: #c1633f;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--color-cream);
    color: var(--color-ink);
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
  }
  .shot {
    width: 780px;
    background: var(--color-white);
    padding: 48px 40px 56px;
  }
  .label {
    margin: 0 0 16px;
    color: var(--color-stone);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .mark {
    width: 36px;
    height: 36px;
    margin: 0 auto 20px;
    border: 2px solid var(--color-emerald);
  }
  h1, h2 {
    margin: 0 auto;
    max-width: 28rem;
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 700;
    line-height: 1.15;
    text-align: center;
  }
  .sub {
    margin: 16px auto 0;
    max-width: 32rem;
    color: var(--color-stone);
    font-size: 0.95rem;
    line-height: 1.55;
    text-align: center;
  }
  .cta-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 400px;
    margin: 40px auto 0;
  }
  .btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    padding: 16px;
    border: 0;
    background: var(--color-emerald);
    color: #fff;
    font-family: var(--font-body);
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .btn-outline {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 16px;
    border: 1px solid var(--color-border-warm);
    background: transparent;
    color: var(--color-ink);
    font-family: var(--font-body);
    font-size: 0.95rem;
    font-weight: 500;
    letter-spacing: 0.02em;
  }
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    border: 0;
    background: var(--color-ink);
    color: #fff;
    font-family: var(--font-body);
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .caps {
    margin: 32px 0 0;
    color: var(--color-stone);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    text-align: center;
  }
  .alt {
    margin: 40px auto 0;
    max-width: 400px;
    padding-top: 32px;
    border-top: 1px solid var(--color-border-warm);
    color: var(--color-stone);
    font-size: 0.875rem;
    text-align: center;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .dash {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
  }
  .dash-note {
    margin: 0 0 8px;
    color: var(--color-stone);
    font-size: 0.75rem;
    text-align: right;
  }
  .modal {
    max-width: 420px;
    margin: 24px auto 0;
    padding: 36px;
    border: 1px solid var(--color-border-warm);
    background: var(--color-white);
  }
  .modal h3 {
    margin: 0 0 24px;
    font-family: var(--font-display);
    font-size: 1.35rem;
  }
  .field {
    margin-bottom: 20px;
  }
  .field span {
    display: block;
    margin-bottom: 10px;
    color: var(--color-stone);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .field input, .field select {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--color-border-warm);
    font: inherit;
  }
  .hint {
    margin: 8px 0 0;
    color: var(--color-stone);
    font-size: 0.75rem;
  }
`

function page(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${css}</style></head>
<body><div class="shot"><p class="label">${title}</p>${body}</div></body></html>`
}

const pages = {
  upload: page(
    '1 · Upload screen (established / CSV-first)',
    `
    <div class="mark" aria-hidden="true"></div>
    <h2>Know exactly what to film. Every sprint.</h2>
    <p class="sub">Upload your TikTok Shop commission report — or add a sample or favorite product — and get a personalized filming schedule.</p>
    <div class="cta-stack">
      <button class="btn-primary" type="button">Choose File</button>
      <button class="btn-outline" type="button">Add a sample or favorite product</button>
    </div>
    <p class="alt">Have some sales but not many? Try Momentum Mode instead</p>
    <p class="caps">Supports .csv and .xlsx files</p>
  `,
  ),
  momentum: page(
    '2 · Momentum mode',
    `
    <div class="mark" aria-hidden="true"></div>
    <h1>You're building momentum.</h1>
    <p class="sub">Upload your commission report — or add a sample or favorite product — and we'll build a balanced schedule while your data builds up.</p>
    <div class="cta-stack">
      <button class="btn-primary" type="button">Choose File</button>
      <button class="btn-outline" type="button">Add a sample or favorite product</button>
    </div>
    <p class="caps">Supports .csv and .xlsx files</p>
    <p class="alt">Established seller? Use full analysis upload instead</p>
  `,
  ),
  empty: page(
    '3 · Empty sprint state',
    `
    <div class="mark" aria-hidden="true"></div>
    <h2>Nothing to schedule yet</h2>
    <p class="sub">Add products to your catalog, upload your commission report, or add a retainer deal to build your first sprint.</p>
    <div class="cta-stack">
      <button class="btn-outline" type="button">Add a sample or favorite product</button>
      <button class="btn-primary" type="button">Upload Report</button>
      <button class="btn-outline" type="button">Add Retainer Deal</button>
    </div>
  `,
  ),
  dashboard: page(
    '4 · Dashboard (products already exist)',
    `
    <p class="dash-note">Same catalog / Test path — dual-writes via upsertCatalogFromMergedProducts</p>
    <div class="dash">
      <button class="btn-secondary" type="button">+ Add Product</button>
      <button class="btn-primary" type="button" style="width:auto;padding:12px 32px">Configure Sprint →</button>
    </div>
    <div class="modal">
      <h3>Add Product</h3>
      <div class="field">
        <span>Product Name</span>
        <input value="Gifted sample serum" readonly />
        <p class="hint">Saved to your durable catalog. Zero-sales products enter as Test (6-video trial).</p>
      </div>
      <div class="field">
        <span>Commission Amount ($)</span>
        <input value="0" readonly />
      </div>
      <div class="field">
        <span>Tier</span>
        <select disabled><option>Test</option></select>
      </div>
    </div>
  `,
  ),
}

const outputs = {
  upload: `${outDir}/entry-upload-catalog-cta.png`,
  momentum: `${outDir}/entry-momentum-catalog-cta.png`,
  empty: `${outDir}/entry-empty-sprint-catalog-cta.png`,
  dashboard: `${outDir}/entry-dashboard-add-product.png`,
}

await mkdir(outDir, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  headless: true,
})
const pageHandle = await browser.newPage({ viewport: { width: 860, height: 1100 } })

for (const [key, html] of Object.entries(pages)) {
  await pageHandle.setContent(html, { waitUntil: 'networkidle' })
  const el = await pageHandle.locator('.shot')
  await el.screenshot({ path: outputs[key], type: 'png' })
  console.log('wrote', outputs[key])
}

await browser.close()
await writeFile(
  `${outDir}/entry-points-index.txt`,
  Object.values(outputs).join('\n') + '\n',
  'utf8',
)
console.log('done')

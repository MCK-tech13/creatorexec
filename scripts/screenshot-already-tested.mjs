import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const outDir = '/opt/cursor/artifacts/screenshots'
const mobilePath = `${outDir}/already-tested-mobile-card.png`
const desktopPath = `${outDir}/already-tested-desktop-row.png`
const afterPath = `${outDir}/already-tested-after-state.png`

const product = {
  productName: 'Satin Heatless Curling Set',
  commission: '$42.18',
  gmv: '$612.40',
  itemsSold: 28,
  orderCount: 24,
  videosFilmed: 2,
}

const css = String.raw`
  :root {
    --font-body: "DM Sans", ui-sans-serif, system-ui, sans-serif;
    --color-cream: #faf7f2;
    --color-white: #ffffff;
    --color-ink: #1a1a1a;
    --color-stone: #8a8a8a;
    --color-border-warm: #e8e8e8;
    --color-emerald: #1a4a3a;
    --color-terracotta: #c1633f;
    --color-tier-test-border: #d8d2c4;
    --color-tier-test-text: #8a8578;
    --color-tier-test-dot: #c1633f;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    min-height: 100vh;
    background: var(--color-cream);
    color: var(--color-ink);
    font-family: var(--font-body);
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  button,
  input {
    font: inherit;
  }

  .shot {
    background: var(--color-cream);
    padding: 28px;
  }

  .shot-desktop {
    width: 1280px;
  }

  .shot-mobile {
    width: 390px;
  }

  .fixture-label {
    margin: 0 0 12px;
    color: var(--color-stone);
    font-size: 11px;
    font-variant: small-caps;
    font-weight: 600;
    letter-spacing: 0.18em;
  }

  .product-list {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--color-border-warm);
  }

  .product-card {
    padding: 16px;
  }

  .product-title {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    color: var(--color-ink);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.375;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .tier-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 8px;
  }

  .commission {
    flex-shrink: 0;
    color: var(--color-emerald);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .tier-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    border-radius: 3px;
    padding: 5px 14px 5px 10px;
    border: 1px solid var(--color-tier-test-border);
    background-color: var(--color-white);
    color: var(--color-tier-test-text);
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
  }

  .tier-badge-dot {
    width: 6px;
    height: 6px;
    flex-shrink: 0;
    border-radius: 9999px;
    background-color: var(--color-tier-test-dot);
  }

  .btn-outline {
    display: inline-flex;
    width: 100%;
    margin-top: 8px;
    align-items: center;
    border: 1px solid var(--color-border-warm);
    border-radius: 0;
    background-color: transparent;
    color: var(--color-ink);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.04em;
    line-height: 1.375;
    padding: 8px 12px;
    text-align: left;
  }

  .meta {
    margin: 6px 0 0;
    color: var(--color-stone);
    font-family: var(--font-body);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .controls {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--color-border-warm);
  }

  .rotation-label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-ink);
    font-family: var(--font-body);
    font-size: 14px;
  }

  .accent-checkbox {
    width: 16px;
    height: 16px;
    accent-color: var(--color-emerald);
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-family: var(--font-body);
    font-size: 14px;
  }

  tr {
    border-bottom: 1px solid var(--color-border-warm);
  }

  th {
    padding: 16px 20px;
    color: var(--color-stone);
    font-family: var(--font-body);
    font-size: 11px;
    font-variant: small-caps;
    font-weight: 600;
    letter-spacing: 0.18em;
    line-height: 1.6;
    text-align: left;
  }

  td {
    padding: 20px;
    vertical-align: top;
  }

  .desktop-product-cell {
    max-width: 320px;
  }

  .desktop-product-title {
    margin: 0;
    overflow: hidden;
    color: var(--color-ink);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .desktop-tier-cell {
    min-width: 190px;
  }

  .desktop-number {
    color: var(--color-ink);
    font-variant-numeric: tabular-nums;
  }

  .desktop-commission {
    color: var(--color-emerald);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .input-field {
    width: 64px;
    border: 1px solid var(--color-border-warm);
    border-radius: 0;
    background: var(--color-white);
    color: var(--color-ink);
    line-height: 1.6;
    padding: 6px 8px;
    text-align: center;
  }

  .progress-track {
    width: 160px;
    height: 6px;
    margin-top: 8px;
    overflow: hidden;
    background: var(--color-border-warm);
  }

  .progress-fill {
    width: 33%;
    height: 100%;
    background: var(--color-emerald);
  }

  .label-caps {
    display: inline-flex;
    margin-top: 8px;
    color: var(--color-emerald);
    font-family: var(--font-body);
    font-size: 11px;
    font-variant: small-caps;
    font-weight: 600;
    letter-spacing: 0.18em;
    line-height: 1.6;
  }

  @media (max-width: 639px) {
    .tier-badge {
      padding: 4px 10px 4px 8px;
      font-size: 11px;
    }

    .tier-badge-dot {
      width: 5px;
      height: 5px;
    }

    .btn-outline {
      font-size: 12px;
    }
  }
`

function tierBadge() {
  return `
    <span class="tier-badge">
      <span class="tier-badge-dot" aria-hidden="true"></span>
      Test
    </span>
  `
}

function trialStatus({ skipped = false } = {}) {
  if (skipped) {
    return '<span class="label-caps">Already tested &mdash; trial skipped</span>'
  }

  return `
    <button
      type="button"
      class="btn-outline"
      title="Skip the 6-video trial if you already filmed and sold this product before CreatorExec. Tier will use this CSV&rsquo;s sales data."
    >
      Already tested this product?
    </button>
  `
}

function mobileCard({ skipped = false } = {}) {
  return `
    <section class="shot shot-mobile" data-screenshot="mobile-card">
      <p class="fixture-label">CreatorExec ProductTable / mobile Test card</p>
      <ul class="product-list">
        <li class="product-card">
          <p class="product-title">${product.productName}</p>
          <div class="tier-row">
            ${tierBadge()}
            <span class="commission">${product.commission}</span>
          </div>
          ${trialStatus({ skipped })}
          <p class="meta">GMV ${product.gmv} &middot; ${product.itemsSold} sold &middot; ${product.orderCount} orders</p>
          <div class="controls">
            <label class="rotation-label">
              <input type="checkbox" checked class="accent-checkbox" />
              In rotation
            </label>
          </div>
        </li>
      </ul>
    </section>
  `
}

function desktopRow({ skipped = false } = {}) {
  return `
    <section class="shot shot-desktop" data-screenshot="desktop-row">
      <p class="fixture-label">CreatorExec ProductTable / desktop Test row</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>In Rotation</th>
              <th>Product</th>
              <th>Tier</th>
              <th>Commission</th>
              <th>GMV</th>
              <th>Items Sold</th>
              <th>Videos Filmed</th>
              <th>Orders</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><input type="checkbox" checked class="accent-checkbox" aria-label="In rotation for ${product.productName}" /></td>
              <td class="desktop-product-cell"><p class="desktop-product-title">${product.productName}</p></td>
              <td class="desktop-tier-cell">
                ${tierBadge()}
                ${trialStatus({ skipped })}
              </td>
              <td class="desktop-commission">${product.commission}</td>
              <td class="desktop-number">${product.gmv}</td>
              <td class="desktop-number">${product.itemsSold}</td>
              <td>
                <input type="number" min="0" value="${skipped ? 6 : product.videosFilmed}" class="input-field" />
                <div class="progress-track"><div class="progress-fill" style="width: ${skipped ? 100 : 33}%"></div></div>
              </td>
              <td class="desktop-number">${product.orderCount}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `
}

function html(body) {
  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>${css}</style>
      </head>
      <body>${body}</body>
    </html>`
}

async function screenshotFixture(page, body, selector, path) {
  await page.setContent(html(body), { waitUntil: 'load' })
  await page.locator(selector).screenshot({ path })
}

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
try {
  const mobilePage = await browser.newPage({ viewport: { width: 430, height: 520 }, deviceScaleFactor: 2 })
  await screenshotFixture(mobilePage, mobileCard(), '[data-screenshot="mobile-card"]', mobilePath)
  await mobilePage.close()

  const desktopPage = await browser.newPage({ viewport: { width: 1360, height: 420 }, deviceScaleFactor: 2 })
  await screenshotFixture(desktopPage, desktopRow(), '[data-screenshot="desktop-row"]', desktopPath)
  await desktopPage.close()

  const afterPage = await browser.newPage({ viewport: { width: 430, height: 430 }, deviceScaleFactor: 2 })
  await screenshotFixture(afterPage, mobileCard({ skipped: true }), '[data-screenshot="mobile-card"]', afterPath)
  await afterPage.close()
} finally {
  await browser.close()
}

console.log(JSON.stringify({ mobilePath, desktopPath, afterPath }, null, 2))

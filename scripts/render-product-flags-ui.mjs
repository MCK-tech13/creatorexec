/**
 * Renders static HTML previews of product flag badges and sprint recap sections.
 * Usage: node scripts/render-product-flags-ui.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const artifacts = '/opt/cursor/artifacts'
mkdirSync(artifacts, { recursive: true })

const commissionNote =
  'Based on commission data from your uploaded reports. Video views and engagement are not tracked yet.'

function productTableHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Product flags — product table badges</title>
  <style>
    :root {
      --ink: #1c1917;
      --stone: #78716c;
      --cream: #faf7f2;
      --border: #e7e0d5;
      --emerald: #1f6b5a;
      --terracotta: #c45c3e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: var(--cream);
      color: var(--ink);
      padding: 32px;
    }
    .wrap { max-width: 980px; margin: 0 auto; }
    h1 { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, serif; font-size: 32px; margin: 0 0 8px; }
    .sub { color: var(--stone); margin-bottom: 24px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--border); }
    th, td { text-align: left; padding: 18px 20px; border-bottom: 1px solid var(--border); font-size: 14px; }
    th { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--stone); }
    .product { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .tier {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
    }
    .tier-test { background: #fff; border: 1px solid #d6d3d1; color: #57534e; }
    .tier-anchor { background: #1f6b5a; color: #fff; }
    .flag {
      display: inline-flex; align-items: center; gap: 4px;
      border: 1px solid; padding: 3px 8px;
      font-size: 10px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase;
    }
    .flag-stalled { border-color: rgba(120,113,108,0.3); background: rgba(120,113,108,0.05); color: var(--stone); }
    .flag-slowing { border-color: rgba(180,83,9,0.25); background: #fffbeb; color: #78350f; }
    .commission { color: var(--emerald); font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Product table badges</h1>
    <p class="sub">Quiet tags on product cards — Stalled (Test/Rising) and Slowing down (Anchor).</p>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Tier</th>
          <th>Commission</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="product">
              <strong>Stuck Balm</strong>
              <span class="flag flag-stalled">◌ Stalled</span>
            </div>
          </td>
          <td><span class="tier tier-test">Test</span></td>
          <td class="commission">$24.00</td>
        </tr>
        <tr>
          <td>
            <div class="product">
              <strong>Cooling Serum</strong>
              <span class="flag flag-slowing">↘ Slowing down</span>
            </div>
          </td>
          <td><span class="tier tier-anchor">Anchor</span></td>
          <td class="commission">$90.00</td>
        </tr>
        <tr>
          <td><strong>Fresh Mask</strong></td>
          <td><span class="tier tier-test">Rising</span></td>
          <td class="commission">$40.00</td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`
}

function recapHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Product flags — sprint recap sections</title>
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
      background: rgba(28,25,23,0.4);
      color: var(--ink);
      padding: 32px;
    }
    .modal {
      max-width: 640px;
      margin: 0 auto;
      background: var(--cream);
      border: 1px solid var(--border);
    }
    .hero {
      border-bottom: 1px solid var(--emerald);
      background: var(--terracotta-tint);
      padding: 28px 32px;
    }
    .hero-kicker {
      font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--emerald); margin: 0;
    }
    .hero h1 {
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, serif;
      font-size: 28px; margin: 8px 0 0;
    }
    .content { padding: 24px; display: grid; gap: 16px; }
    .section { border: 1px solid var(--border); background: #fff; }
    .section h2 {
      margin: 0; padding: 12px 20px; border-bottom: 1px solid var(--border);
      font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--stone);
    }
    .section-body { padding: 16px 20px; }
    .section-body p { margin: 0 0 12px; color: var(--stone); font-size: 14px; line-height: 1.5; }
    .section-body p.note { font-size: 12px; margin-bottom: 16px; }
    ul { list-style: none; margin: 0; padding: 0; }
    li {
      display: flex; justify-content: space-between; align-items: center;
      gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border);
    }
    li:last-child { border-bottom: 0; padding-bottom: 0; }
    .tier {
      display: inline-flex; padding: 4px 10px; font-size: 11px;
      letter-spacing: 0.08em; text-transform: uppercase;
    }
    .tier-test { background: #fff; border: 1px solid #d6d3d1; color: #57534e; }
    .tier-anchor { background: #1f6b5a; color: #fff; }
  </style>
</head>
<body>
  <div class="modal">
    <div class="hero">
      <p class="hero-kicker">Sprint complete</p>
      <h1>What happened this sprint</h1>
    </div>
    <div class="content">
      <section class="section">
        <h2>Consider cutting</h2>
        <div class="section-body">
          <p>These Test and Rising products have not moved tiers for two consecutive sprints.</p>
          <ul>
            <li><strong>Stuck Balm</strong><span class="tier tier-test">Test</span></li>
            <li><strong>Flat Lip Oil</strong><span class="tier tier-test">Rising</span></li>
          </ul>
        </div>
      </section>
      <section class="section">
        <h2>Trending down</h2>
        <div class="section-body">
          <p>Worth keeping an eye on — these Anchor products have seen commission decline for three consecutive sprints.</p>
          <p class="note">${commissionNote}</p>
          <ul>
            <li><strong>Cooling Serum</strong><span class="tier tier-anchor">Anchor</span></li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</body>
</html>`
}

async function capture(name, html) {
  const htmlPath = path.join(artifacts, `${name}.html`)
  writeFileSync(htmlPath, html, 'utf8')

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(`file://${htmlPath}`)
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true })
  await browser.close()
  console.log(`Wrote ${path.join(artifacts, `${name}.png`)}`)
}

await capture('product-flags-badges', productTableHtml())
await capture('product-flags-recap', recapHtml())

/**
 * Live Production test: hold a tab across a new deploy and confirm auto-reload.
 *
 * Usage: npx tsx scripts/live-version-reload-test.mjs
 *
 * Expects:
 * 1) Current Production already serving /version.json
 * 2) A follow-up commit will be pushed to main while this script holds the tab
 *
 * Env:
 *   HOLD_ONLY=1  — open tab, print SHA, wait forever for external deploy (default flow below)
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'

const SITE = 'https://www.creatorexec.app'
const evidence = []
const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}`
  evidence.push(line)
  console.log(line)
}

async function fetchVersion() {
  const res = await fetch(`${SITE}/version.json?t=${Date.now()}`, { cache: 'no-store' })
  const ct = res.headers.get('content-type') || ''
  const body = await res.text()
  if (!ct.includes('json')) {
    throw new Error(`version.json not JSON (content-type=${ct}) body starts: ${body.slice(0, 80)}`)
  }
  return JSON.parse(body)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

log('Opening Production landing page (held tab)')
await page.goto(SITE + '/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForFunction(() => typeof window.__CE_CLIENT_SHA__ === 'string', null, {
  timeout: 30_000,
})
const assetBefore = await page.locator('script[src*="/assets/index-"]').first().getAttribute('src')
const clientShaBefore = await page.evaluate(() => window.__CE_CLIENT_SHA__ || null)
const versionBefore = await fetchVersion()
log(`Held tab asset=${assetBefore}`)
log(`Held tab __CE_CLIENT_SHA__=${clientShaBefore}`)
log(`Live version.json sha=${versionBefore.sha} builtAt=${versionBefore.builtAt}`)

if (!clientShaBefore) {
  await browser.close()
  throw new Error('__CE_CLIENT_SHA__ missing — version guard not mounted on this deploy')
}
if (clientShaBefore !== versionBefore.sha) {
  log('WARNING: held tab SHA already differs from version.json at start')
}

// Signal to outer process that the tab is held and ready for a follow-up deploy.
writeFileSync('/tmp/version-reload-hold-ready.json', JSON.stringify({
  readyAt: new Date().toISOString(),
  clientShaBefore,
  versionBefore,
  assetBefore,
}, null, 2))
log('HOLD READY — waiting for version.json SHA to change (follow-up deploy)')

let versionAfter = versionBefore
const deadline = Date.now() + 8 * 60 * 1000
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 5000))
  try {
    versionAfter = await fetchVersion()
  } catch (err) {
    log(`version fetch error: ${err.message}`)
    continue
  }
  if (versionAfter.sha !== versionBefore.sha) {
    log(`version.json changed → ${versionAfter.sha} builtAt=${versionAfter.builtAt}`)
    break
  }
  log(`still waiting… live=${versionAfter.sha.slice(0, 12)}`)
}

if (versionAfter.sha === versionBefore.sha) {
  await browser.close()
  throw new Error('Timed out waiting for follow-up Production deploy')
}

const changedAt = new Date().toISOString()
log(`Deploy detected at ${changedAt}; dispatching focus to trigger immediate version check`)

// Trigger the focus listener (also covers visibility).
await page.evaluate(() => {
  window.dispatchEvent(new Event('focus'))
  document.dispatchEvent(new Event('visibilitychange'))
})

log('Waiting for held tab to reload onto new asset/SHA…')
const reloadStarted = Date.now()
await page.waitForFunction(
  ({ oldAsset, oldSha }) => {
    const script = document.querySelector('script[src*="/assets/index-"]')
    const asset = script?.getAttribute('src')
    const sha = window.__CE_CLIENT_SHA__
    return Boolean(asset && asset !== oldAsset && sha && sha !== oldSha)
  },
  { oldAsset: assetBefore, oldSha: clientShaBefore },
  { timeout: 120_000 },
)

const assetAfter = await page.locator('script[src*="/assets/index-"]').first().getAttribute('src')
const clientShaAfter = await page.evaluate(() => window.__CE_CLIENT_SHA__ || null)
const reloadedAt = new Date().toISOString()
const reloadMs = Date.now() - reloadStarted

log(`RELOAD CONFIRMED at ${reloadedAt} (${reloadMs}ms after focus)`)
log(`After asset=${assetAfter}`)
log(`After __CE_CLIENT_SHA__=${clientShaAfter}`)
log(`After version.json sha=${versionAfter.sha}`)

const ok = clientShaAfter === versionAfter.sha
log(`SHA match after reload: ${ok}`)

mkdirSync('/opt/cursor/artifacts', { recursive: true })
writeFileSync('/opt/cursor/artifacts/version-reload-evidence.txt', evidence.join('\n') + '\n')
writeFileSync(
  '/opt/cursor/artifacts/version-reload-evidence.json',
  JSON.stringify(
    {
      clientShaBefore,
      assetBefore,
      versionBefore,
      versionAfter,
      clientShaAfter,
      assetAfter,
      changedAt,
      reloadedAt,
      reloadMs,
      ok,
    },
    null,
    2,
  ),
)

await browser.close()
if (!ok) process.exit(1)
console.log('\nLive version-reload test PASSED')

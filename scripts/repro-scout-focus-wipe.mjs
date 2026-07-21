/**
 * Reproduce Product Scout preview wipe on tab blur/focus.
 * Distinguishes version-guard reload vs in-app remount.
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'

const SITE = 'https://www.creatorexec.app'
const SUPABASE_URL = 'https://utyfuportzbwqrxutdei.supabase.co'
const ANON = 'sb_publishable_cmPeFJQdE6_P4zZ0zWN6qw_W1yc1Jfg'
const email = 'scout1784662361@mailinator.com'
const password = 'ProbePass123!Aa'

const evidence = []
const log = (m) => {
  const line = `[${new Date().toISOString()}] ${m}`
  evidence.push(line)
  console.log(line)
}
mkdirSync('/opt/cursor/artifacts', { recursive: true })

const authClient = createClient(SUPABASE_URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
  email,
  password,
})
if (signInError) throw new Error(signInError.message)
const session = signInData.session
const userId = session.user.id
log(`Signed in ${userId}`)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

page.on('console', (msg) => {
  const t = msg.text()
  if (/reload|version|dirty|persist|ProductScout|visibility|focus|Loading your saved/i.test(t)) {
    log(`[browser:${msg.type()}] ${t}`)
  }
})

let navigations = []
page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) {
    navigations.push({ at: new Date().toISOString(), url: frame.url() })
    log(`NAV ${frame.url()}`)
  }
})

await page.route('**/rest/v1/user_subscriptions*', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      {
        user_id: userId,
        stripe_customer_id: 'cus_fake',
        stripe_subscription_id: 'sub_fake',
        subscription_status: 'trialing',
        price_id: 'price_fake',
        current_period_end: new Date(Date.now() + 7 * 864e5).toISOString(),
        cancel_at_period_end: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]),
  })
})

// Track version.json checks
const versionChecks = []
await page.route('**/version.json*', async (route) => {
  const res = await route.fetch()
  const body = await res.text()
  versionChecks.push({ at: new Date().toISOString(), status: res.status(), body: body.slice(0, 200) })
  log(`version.json check → ${res.status()} ${body.slice(0, 120)}`)
  await route.fulfill({ status: res.status(), headers: res.headers(), body })
})

await page.goto(SITE + '/login', { waitUntil: 'domcontentloaded' })
await page.evaluate(({ session }) => {
  localStorage.setItem(
    'sb-utyfuportzbwqrxutdei-auth-token',
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user,
    }),
  )
}, { session })

await page.goto(SITE + '/app/product-scout', { waitUntil: 'networkidle', timeout: 90_000 })
await page.waitForTimeout(2500)

// Ensure on "new" form
const scoreNew = page.getByRole('button', { name: /Score a new product|SCORE NEW PRODUCT/i })
if (await scoreNew.count()) await scoreNew.first().click()
await page.waitForTimeout(500)

const textInputs = page.locator('form input[type="text"], form input:not([type])')
const count = await textInputs.count()
log(`inputs=${count}`)
const values = ['Hadley Focus Test', '2.5K', '+2.1K', '3.2', '-0.3', '500', '+67', '20K', '+13.5K']
for (let i = 0; i < Math.min(count, values.length); i++) {
  await textInputs.nth(i).fill(values[i])
}
await page.waitForTimeout(800)

const before = await page.evaluate(() => {
  const body = document.body.innerText
  return {
    worthTesting: /Worth testing/i.test(body),
    clientSha: window.__CE_CLIENT_SHA__ || null,
    dirtyHint: body.slice(0, 200),
    // probe dirty registry if exposed — usually not
  }
})
log(`BEFORE focus: ${JSON.stringify(before)}`)
await page.screenshot({ path: '/opt/cursor/artifacts/scout-focus-before.png', fullPage: true })

// Probe whether dirty set is active by checking mark was applied via internal state —
// inject a read of module isn't possible; instead check if reload is held when we force stale.

const navCountBefore = navigations.length
const versionCountBefore = versionChecks.length

log('Simulating tab hide → show + window focus')
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'hidden',
  })
  document.dispatchEvent(new Event('visibilitychange'))
})
await page.waitForTimeout(300)
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  })
  document.dispatchEvent(new Event('visibilitychange'))
  window.dispatchEvent(new Event('focus'))
})
await page.waitForTimeout(3000)

const after = await page.evaluate(() => {
  const body = document.body.innerText
  return {
    worthTesting: /Worth testing/i.test(body),
    pass: /\bPass\b/.test(body),
    clientSha: window.__CE_CLIENT_SHA__ || null,
    hasHadley: /Hadley Focus Test/i.test(body),
    bodySample: body.slice(0, 600).replace(/\n/g, ' | '),
  }
})
log(`AFTER focus (SHA current): ${JSON.stringify(after)}`)
log(`navigations delta=${navigations.length - navCountBefore} versionChecks delta=${versionChecks.length - versionCountBefore}`)
await page.screenshot({ path: '/opt/cursor/artifacts/scout-focus-after-current.png', fullPage: true })

// Force STALE client SHA so version guard would want to reload
log('Forcing stale __CE / import meta path: override fetchLive vs loaded by patching check')
// Easiest: intercept version.json to return a different SHA than client
await page.unroute('**/version.json*')
await page.route('**/version.json*', async (route) => {
  const fake = JSON.stringify({
    sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    builtAt: new Date().toISOString(),
  })
  versionChecks.push({ at: new Date().toISOString(), status: 200, body: fake, forcedStale: true })
  log(`version.json FORCED STALE → ${fake}`)
  await route.fulfill({ status: 200, contentType: 'application/json', body: fake })
})

// Re-fill if wiped
const stillHasPreview = after.worthTesting && after.hasHadley
if (!stillHasPreview) {
  log('Preview was wiped on current-SHA focus — refilling for stale test')
  const scoreNew2 = page.getByRole('button', { name: /Score a new product|SCORE NEW PRODUCT/i })
  if (await scoreNew2.count()) await scoreNew2.first().click()
  await page.waitForTimeout(400)
  const inputs2 = page.locator('form input[type="text"], form input:not([type])')
  const c2 = await inputs2.count()
  for (let i = 0; i < Math.min(c2, values.length); i++) await inputs2.nth(i).fill(values[i])
  await page.waitForTimeout(500)
}

const dirtyProbe = await page.evaluate(async () => {
  // Call into dirty registry via dynamic import of built chunks is hard.
  // Instead observe: if reload happens, performance navigation type / timestamp.
  return {
    sha: window.__CE_CLIENT_SHA__,
    href: location.href,
    hasPreview: /Worth testing/i.test(document.body.innerText),
  }
})
log(`Before stale focus: ${JSON.stringify(dirtyProbe)}`)

const reloadPromise = page.waitForNavigation({ timeout: 8000 }).then(() => 'reloaded').catch(() => 'no-reload')
await page.evaluate(() => {
  document.dispatchEvent(new Event('visibilitychange'))
  window.dispatchEvent(new Event('focus'))
})
const reloadResult = await reloadPromise
await page.waitForTimeout(2000)

const afterStale = await page.evaluate(() => {
  const body = document.body.innerText
  return {
    worthTesting: /Worth testing/i.test(body),
    hasHadley: /Hadley Focus Test/i.test(body),
    clientSha: window.__CE_CLIENT_SHA__ || null,
    bodySample: body.slice(0, 500).replace(/\n/g, ' | '),
    draftKeys: Object.keys(sessionStorage).filter((k) => /scout|draft|ce-/i.test(k)),
  }
})
log(`AFTER stale focus: reload=${reloadResult} ${JSON.stringify(afterStale)}`)
await page.screenshot({ path: '/opt/cursor/artifacts/scout-focus-after-stale.png', fullPage: true })

writeFileSync(
  '/opt/cursor/artifacts/scout-focus-repro.json',
  JSON.stringify({ before, after, afterStale, reloadResult, navigations, versionChecks, evidence }, null, 2),
)
writeFileSync('/opt/cursor/artifacts/scout-focus-repro.txt', evidence.join('\n') + '\n')
await browser.close()
log('DONE')

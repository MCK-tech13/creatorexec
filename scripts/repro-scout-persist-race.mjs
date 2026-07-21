/**
 * Reproduce Product Scout post-submit UI revert on Production (PR #36).
 *
 * Hypothesis: mount-time persistNow() starts with a stale entry list; if a
 * submit upsert finishes first, the in-flight mount upsert later overwrites
 * DB with old metrics (200, no error). A subsequent hydrate/reload shows Pass.
 *
 * Captures full product_scout_list request/response bodies.
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'

const SITE = 'https://www.creatorexec.app'
const SUPABASE_URL = 'https://utyfuportzbwqrxutdei.supabase.co'
const ANON = 'sb_publishable_cmPeFJQdE6_P4zZ0zWN6qw_W1yc1Jfg'

const evidence = []
const log = (m) => {
  const line = `[${new Date().toISOString()}] ${m}`
  evidence.push(line)
  console.log(line)
}

mkdirSync('/opt/cursor/artifacts', { recursive: true })

// Reuse confirmed account from prior repro
const email = 'scout1784662361@mailinator.com'
const password = 'ProbePass123!Aa'

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

// Clean slate: delete existing scout rows, seed ONE stale Hadley
await authClient.from('product_scout_list').delete().eq('user_id', userId)

const seedId = crypto.randomUUID()
const oldMetrics = {
  // Metrics that LIVE-score as Worth testing under v2, but we store pass/0
  orders: { value: '2.5K', delta: '+2.1K' },
  ctr: { value: '3.2', delta: '-0.3' },
  creators: { value: '500', delta: '+67' },
  atcUsers: { value: '20K', delta: '+13.5K' },
}
// Weak metrics that live-score as Pass — used after overwrite to prove UI revert
// Actually for overwrite race we keep SAME metrics object in the stale in-memory
// mount payload; UI would still show Worth testing from live score of same metrics.
// To match user symptom (UI shows Pass), stale overwrite must change metrics OR
// we need remount from DB columns somehow.
//
// Better seed: start with WEAK metrics in DB (pass/0). User edits to STRONG metrics.
// Mount persist captures WEAK. Submit writes STRONG. Mount finishes, writes WEAK.
// Reload → UI Pass.

const weakMetrics = {
  orders: { value: '100', delta: '0' },
  ctr: { value: '1.0', delta: '-0.5' },
  creators: { value: '3000', delta: '+500' },
  atcUsers: { value: '2000', delta: '-100' },
}
const strongMetrics = {
  orders: { value: '2.5K', delta: '+2.1K' },
  ctr: { value: '3.2', delta: '-0.3' },
  creators: { value: '500', delta: '+67' },
  atcUsers: { value: '20K', delta: '+13.5K' },
}

const { error: seedErr } = await authClient.from('product_scout_list').insert({
  id: seedId,
  user_id: userId,
  product_name: 'Hadley Designs - Busy Book',
  metrics: weakMetrics,
  verdict: 'pass',
  total_score: 0,
  scoring_logic_version: null,
  funnel_recommendation: null,
  created_at: '2026-07-10T12:00:00.000Z',
  updated_at: '2026-07-10T12:00:00.000Z',
})
log(`Seed Hadley id=${seedId} weak/pass/0 err=${seedErr?.message ?? 'none'}`)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

const scoutEvents = []
const consoleLines = []
page.on('console', (msg) => {
  const text = `[browser:${msg.type()}] ${msg.text()}`
  consoleLines.push(text)
  if (msg.type() === 'error' || /persist|Failed|ProductScout|__CE_/i.test(text)) log(text)
})
page.on('pageerror', (err) => log(`[pageerror] ${err.message}`))

// Hold the FIRST upsert POST until we release it (simulates slow mount backfill)
let upsertCount = 0
let releaseMountUpsert
const mountUpsertHeld = new Promise((resolve) => {
  releaseMountUpsert = resolve
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

await page.route('**/rest/v1/product_scout_list*', async (route) => {
  const req = route.request()
  const method = req.method()
  const url = req.url()
  const postData = req.postData()
  const headers = req.headers()

  // Delay only the first POST upsert (mount backfill)
  const isUpsert = method === 'POST' && /product_scout_list/i.test(url)
  if (isUpsert) {
    upsertCount += 1
    const n = upsertCount
    if (n === 1) {
      log(`HOLDING mount upsert #1 until submit completes…`)
      log(`MOUNT UPSERT REQUEST BODY: ${postData?.slice(0, 3000)}`)
      await mountUpsertHeld
      log(`RELEASING mount upsert #1`)
    } else {
      log(`UPSERT #${n} REQUEST BODY: ${postData?.slice(0, 3000)}`)
    }
  }

  const response = await route.fetch({
    headers: {
      ...headers,
      // Force representation so we can inspect response bodies
      Prefer: isUpsert
        ? 'resolution=merge-duplicates,return=representation'
        : headers.prefer || headers.Prefer || '',
    },
  })
  const status = response.status()
  const body = await response.text()
  const respHeaders = response.headers()

  scoutEvents.push({
    at: new Date().toISOString(),
    method,
    url,
    status,
    requestBody: postData,
    responseBody: body,
    responseHeaders: {
      'content-type': respHeaders['content-type'],
      'preference-applied': respHeaders['preference-applied'],
      'content-range': respHeaders['content-range'],
    },
    heldMount: isUpsert && upsertCount === 1,
    upsertIndex: isUpsert ? upsertCount : null,
  })

  log(
    `NET ${method} → ${status} upsert#=${isUpsert ? upsertCount : '-'} body=${body.slice(0, 500).replace(/\s+/g, ' ')}`,
  )

  await route.fulfill({
    status,
    headers: respHeaders,
    body,
  })
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

log('Navigate to product-scout (mount backfill will be held)')
await page.goto(SITE + '/app/product-scout', { waitUntil: 'domcontentloaded', timeout: 90_000 })
await page.waitForTimeout(2500)

let bodyText = await page.locator('body').innerText()
log(`UI after load: Pass=${/\bPass\b/.test(bodyText)} WorthTesting=${/Worth testing/i.test(bodyText)}`)
log(`Body sample: ${bodyText.slice(0, 500).replace(/\n/g, ' | ')}`)
await page.screenshot({ path: '/opt/cursor/artifacts/scout-race-1-loaded.png', fullPage: true })

// Open edit for Hadley
const editBtn = page.getByRole('button', { name: /^Edit$/i }).or(page.getByRole('button', { name: /Edit metrics/i }))
if (await page.getByRole('button', { name: /Edit metrics/i }).count()) {
  await page.getByRole('button', { name: /Edit metrics/i }).first().click()
} else {
  // select list item then edit
  await page.getByText('Hadley Designs - Busy Book').first().click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Edit metrics/i }).click()
}
await page.waitForTimeout(800)

const textInputs = page.locator('form input[type="text"], form input:not([type])')
const count = await textInputs.count()
log(`edit form inputs=${count}`)
const values = [
  'Hadley Designs - Busy Book',
  strongMetrics.orders.value,
  strongMetrics.orders.delta,
  strongMetrics.ctr.value,
  strongMetrics.ctr.delta,
  strongMetrics.creators.value,
  strongMetrics.creators.delta,
  strongMetrics.atcUsers.value,
  strongMetrics.atcUsers.delta,
]
for (let i = 0; i < Math.min(count, values.length); i++) {
  await textInputs.nth(i).fill(values[i])
}
await page.waitForTimeout(800)
bodyText = await page.locator('body').innerText()
log(`Preview after edit fill: WorthTesting=${/Worth testing/i.test(bodyText)}`)

const submit = page.getByRole('button', { name: /Save to Product List|Add to Product List/i })
log('Clicking Save (submit upsert should proceed while mount still held)')
await submit.first().click()
await page.waitForTimeout(4000)

bodyText = await page.locator('body').innerText()
const persistErr = await page.evaluate(() => window.__CE_LAST_PERSIST_ERROR__ || null)
log(`After submit (mount still held): WorthTesting=${/Worth testing/i.test(bodyText)} Pass=${/\bPass\b/.test(bodyText)} persistErr=${persistErr}`)
log(`Body: ${bodyText.slice(0, 600).replace(/\n/g, ' | ')}`)
await page.screenshot({ path: '/opt/cursor/artifacts/scout-race-2-after-submit.png', fullPage: true })

// DB should have strong scores now (submit won)
let { data: midRows } = await authClient
  .from('product_scout_list')
  .select('id,product_name,total_score,verdict,scoring_logic_version,metrics,updated_at')
  .eq('user_id', userId)
log(`DB after submit, before releasing mount: ${JSON.stringify(midRows, null, 2)}`)

log('Releasing mount upsert (stale weak metrics)…')
releaseMountUpsert()
await page.waitForTimeout(4000)

let { data: afterMountRows } = await authClient
  .from('product_scout_list')
  .select('id,product_name,total_score,verdict,scoring_logic_version,metrics,updated_at')
  .eq('user_id', userId)
log(`DB after mount upsert released: ${JSON.stringify(afterMountRows, null, 2)}`)

bodyText = await page.locator('body').innerText()
log(
  `UI after mount released (no reload): WorthTesting=${/Worth testing/i.test(bodyText)} Pass=${/\bPass\b/.test(bodyText)} persistErr=${await page.evaluate(() => window.__CE_LAST_PERSIST_ERROR__ || null)}`,
)

// Force reload to simulate session refresh / hydrate from DB
log('Reloading page to hydrate from DB…')
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3500)
bodyText = await page.locator('body').innerText()
const persistErr2 = await page.evaluate(() => window.__CE_LAST_PERSIST_ERROR__ || null)
log(
  `UI after reload: WorthTesting=${/Worth testing/i.test(bodyText)} Pass=${/\bPass\b/.test(bodyText)} persistErr=${persistErr2}`,
)
log(`Body: ${bodyText.slice(0, 700).replace(/\n/g, ' | ')}`)
await page.screenshot({ path: '/opt/cursor/artifacts/scout-race-3-after-reload.png', fullPage: true })

writeFileSync(
  '/opt/cursor/artifacts/scout-race-repro.json',
  JSON.stringify(
    {
      userId,
      seedId,
      scoutEvents,
      consoleLines,
      midRows,
      afterMountRows,
      evidence,
    },
    null,
    2,
  ),
)
writeFileSync('/opt/cursor/artifacts/scout-race-repro.txt', evidence.join('\n') + '\n')

await browser.close()
log('DONE')

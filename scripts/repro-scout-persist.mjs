/**
 * Reproduce Product Scout persist on Production with a confirmed account.
 * Captures console + network around submit.
 *
 * Flow: signup → mailinator confirm → inject session → submit Hadley product →
 * inspect product_scout_list requests/responses + DB rows.
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'

const SITE = 'https://www.creatorexec.app'
const SUPABASE_URL = 'https://utyfuportzbwqrxutdei.supabase.co'
const ANON = 'sb_publishable_cmPeFJQdE6_P4zZ0zWN6qw_W1yc1Jfg'

const suffix = Date.now().toString(36)
const emailLocal = `scout-persist-${suffix}`
const email = `${emailLocal}@mailinator.com`
const password = `Persist-${suffix}-Aa1!`

const evidence = []
const log = (m) => {
  const line = `[${new Date().toISOString()}] ${m}`
  evidence.push(line)
  console.log(line)
}

mkdirSync('/opt/cursor/artifacts', { recursive: true })

async function safeJson(res) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function fetchMailinatorConfirmLink(inbox, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(
        `https://www.mailinator.com/api/v2/domains/public/inboxes/${inbox}`,
      )
      const data = res.ok ? await safeJson(res) : null
      const msgs = data?.msgs || []
      const confirm = msgs.find((m) => /confirm/i.test(m.subject || ''))
      if (confirm) {
        const msgRes = await fetch(
          `https://www.mailinator.com/api/v2/domains/public/inboxes/${inbox}/messages/${confirm.id}`,
        )
        const msg = await safeJson(msgRes)
        if (msg) {
          const body = JSON.stringify(msg)
          const match = body.match(
            /https:\/\/utyfuportzbwqrxutdei\.supabase\.co\/auth\/v1\/verify\?token=[a-z0-9]+&type=signup[^"\\]*/i,
          )
          if (match) {
            return match[0].replace(/&amp;/g, '&').replace(/\\u0026/g, '&')
          }
        }
      }
    } catch (err) {
      log(`mailinator poll error: ${err instanceof Error ? err.message : String(err)}`)
    }
    await new Promise((r) => setTimeout(r, 2500))
  }
  throw new Error('Timed out waiting for confirmation email')
}

log(`Creating account: ${email}`)
const authClient = createClient(SUPABASE_URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data: signUpData, error: signUpError } = await authClient.auth.signUp({
  email,
  password,
})
if (signUpError) log(`signUp error: ${signUpError.message}`)
log(`signUp user=${signUpData?.user?.id ?? 'none'} session=${Boolean(signUpData?.session)}`)

if (!signUpData?.session) {
  log('Confirming email via mailinator…')
  const link = await fetchMailinatorConfirmLink(emailLocal)
  log(`Confirm link found: ${link.slice(0, 80)}…`)
  const verifyRes = await fetch(link, { redirect: 'manual' })
  log(`Verify status=${verifyRes.status} location=${verifyRes.headers.get('location')?.slice(0, 80)}`)
}

const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
  email,
  password,
})
if (signInError) {
  log(`signIn error: ${signInError.message}`)
  writeFileSync('/opt/cursor/artifacts/scout-persist-repro.txt', evidence.join('\n'))
  throw new Error(signInError.message)
}
const session = signInData.session
log(`Signed in user=${session.user.id}`)

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

const consoleLines = []
page.on('console', (msg) => {
  const text = `[browser:${msg.type()}] ${msg.text()}`
  consoleLines.push(text)
  if (
    msg.type() === 'error' ||
    /persist|Failed|supabase|ProductScout|__CE_/i.test(text)
  ) {
    log(text)
  }
})
page.on('pageerror', (err) => log(`[pageerror] ${err.message}`))

const scoutRequests = []
page.on('request', (req) => {
  const url = req.url()
  if (url.includes('product_scout_list') || url.includes('rest/v1/')) {
    if (url.includes('product_scout_list')) {
      scoutRequests.push({
        phase: 'request',
        method: req.method(),
        url,
        postData: req.postData()?.slice(0, 4000) ?? null,
        at: new Date().toISOString(),
      })
    }
  }
})
page.on('response', async (res) => {
  const url = res.url()
  if (!url.includes('product_scout_list')) return
  let body = ''
  try {
    body = await res.text()
  } catch {
    body = '<unreadable>'
  }
  scoutRequests.push({
    phase: 'response',
    method: res.request().method(),
    url,
    status: res.status(),
    body: body.slice(0, 4000),
    at: new Date().toISOString(),
  })
  log(`NET ${res.request().method()} product_scout_list → ${res.status()} ${body.slice(0, 400)}`)
})

await page.goto(SITE + '/login', { waitUntil: 'domcontentloaded' })
const projectRef = 'utyfuportzbwqrxutdei'
const storageKey = `sb-${projectRef}-auth-token`
await page.evaluate(
  ({ storageKey, session }) => {
    const payload = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user,
    }
    localStorage.setItem(storageKey, JSON.stringify(payload))
  },
  { storageKey, session },
)

log('Session injected; navigating to /app/product-scout')
await page.goto(SITE + '/app/product-scout', { waitUntil: 'networkidle', timeout: 90_000 })
await page.waitForTimeout(2500)
log(`URL after nav: ${page.url()}`)
const bodyText = await page.locator('body').innerText()
log(`Body sample: ${bodyText.slice(0, 500).replace(/\n/g, ' | ')}`)

// Capture client SHA / whether new scoring is live
const clientMeta = await page.evaluate(() => ({
  sha: window.__CE_CLIENT_SHA__ || null,
  persistErr: window.__CE_LAST_PERSIST_ERROR__ || null,
}))
log(`Client meta: ${JSON.stringify(clientMeta)}`)

const onGate =
  /subscribe|start.?trial|billing|upgrade/i.test(bodyText) &&
  !/Score a new product|Product Scout|Add to Product List/i.test(bodyText)
if (onGate) {
  log('BLOCKED by subscription/billing gate — cannot reach Product Scout form')
  // Still try direct persist API to isolate UI vs API
} else {
  // Open new form if on list
  const scoreNew = page.getByRole('button', { name: /Score a new product|New product|Add product/i })
  if (await scoreNew.count()) {
    await scoreNew.first().click().catch(() => {})
    await page.waitForTimeout(500)
  }

  const name = 'Hadley Designs - Busy Book REPRO'
  log(`Filling form for ${name}`)

  // Prefer labeled inputs if present; else fill text inputs in order
  const textInputs = page.locator('form input[type="text"], form input:not([type])')
  const count = await textInputs.count()
  log(`text inputs: ${count}`)
  const values = [
    name,
    '2.5K',
    '+2.1K',
    '3.2',
    '-0.3',
    '500',
    '+67',
    '20K',
    '+13.5K',
  ]
  for (let i = 0; i < Math.min(count, values.length); i++) {
    await textInputs.nth(i).fill(values[i])
  }

  await page.waitForTimeout(800)
  const preview = await page.locator('body').innerText()
  log(
    `Preview: worthTesting=${/Worth testing/i.test(preview)} strong=${/Strong opportunity/i.test(preview)} pass=${/\bPass\b/.test(preview)}`,
  )

  const submit = page.getByRole('button', { name: /Add to Product List|Save to Product List/i })
  log(`Submit enabled? count=${await submit.count()}`)
  if (await submit.count()) {
    log(`Clicking submit at ${new Date().toISOString()}`)
    await submit.first().click()
    await page.waitForTimeout(6000)
  } else {
    log('No submit button found')
  }

  const afterText = await page.locator('body').innerText()
  log(`After submit sample: ${afterText.slice(0, 600).replace(/\n/g, ' | ')}`)
  const persistErr = await page.evaluate(() => window.__CE_LAST_PERSIST_ERROR__ || null)
  log(`window.__CE_LAST_PERSIST_ERROR__=${persistErr}`)
}

log(`Scout network events: ${scoutRequests.length}`)
for (const ev of scoutRequests) {
  log(JSON.stringify(ev).slice(0, 1500))
}

const userClient = createClient(SUPABASE_URL, ANON, {
  global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data: rows, error: selectError } = await userClient
  .from('product_scout_list')
  .select('id,product_name,total_score,verdict,scoring_logic_version,created_at,updated_at')
  .order('created_at', { ascending: false })

log(`DB select error: ${selectError?.message ?? 'none'}`)
log(`DB rows: ${JSON.stringify(rows, null, 2)}`)

writeFileSync(
  '/opt/cursor/artifacts/scout-persist-repro.json',
  JSON.stringify(
    {
      email,
      password,
      userId: session.user.id,
      scoutRequests,
      consoleLines,
      rows,
      selectError,
      evidence,
    },
    null,
    2,
  ),
)
writeFileSync('/opt/cursor/artifacts/scout-persist-repro.txt', evidence.join('\n') + '\n')

await browser.close()
console.log('\nDone. See /opt/cursor/artifacts/scout-persist-repro.json')

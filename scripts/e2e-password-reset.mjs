/**
 * Browser E2E: Supabase recovery email → reset form → login with new password.
 *
 * Uses a real mail.tm inbox against production Supabase Auth (Resend SMTP).
 *
 *   node scripts/e2e-password-reset.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const ARTIFACT_DIR = '/opt/cursor/artifacts/password-reset-e2e'

const SUPABASE_URL = 'https://utyfuportzbwqrxutdei.supabase.co'
const ANON_KEY = 'sb_publishable_cmPeFJQdE6_P4zZ0zWN6qw_W1yc1Jfg'
const RESET_REDIRECT = 'https://creatorexec.app/reset-password'

const stamp = Date.now()
const mailboxPass = `Mail-${stamp}-Aa1!`
const initialPassword = `Init-${stamp}-Aa1!`
const newPassword = `New-${stamp}-Bb2!`

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createMailbox() {
  const domainsRes = await fetch('https://api.mail.tm/domains')
  if (!domainsRes.ok) throw new Error(`mail.tm domains HTTP ${domainsRes.status}`)
  const domains = await domainsRes.json()
  const domain = domains['hydra:member']?.[0]?.domain
  if (!domain) throw new Error('mail.tm returned no domain')

  const address = `ce${stamp}@${domain}`
  const createRes = await fetch('https://api.mail.tm/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password: mailboxPass }),
  })
  if (!createRes.ok) {
    throw new Error(`mail.tm create account HTTP ${createRes.status}: ${await createRes.text()}`)
  }

  const tokenRes = await fetch('https://api.mail.tm/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password: mailboxPass }),
  })
  if (!tokenRes.ok) throw new Error(`mail.tm token HTTP ${tokenRes.status}`)
  const { token } = await tokenRes.json()
  if (!token) throw new Error('mail.tm token missing')
  return { address, token }
}

async function listMessages(token) {
  const res = await fetch('https://api.mail.tm/messages', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`mail.tm messages HTTP ${res.status}`)
  const data = await res.json()
  return data['hydra:member'] || []
}

async function readMessage(token, id) {
  const res = await fetch(`https://api.mail.tm/messages/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`mail.tm message HTTP ${res.status}`)
  return res.json()
}

async function waitForSubject(token, predicate, timeoutMs = 120000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const messages = await listMessages(token)
    const match = messages.find((m) => predicate(m.subject || ''))
    if (match) return readMessage(token, match.id)
    await sleep(3000)
  }
  throw new Error('Timed out waiting for email')
}

function extractVerifyLink(message) {
  const html = message.html?.[0] || ''
  const text = message.text || ''
  const body = `${html}\n${text}`
  const href = body.match(
    /https:\/\/utyfuportzbwqrxutdei\.supabase\.co\/auth\/v1\/verify\?[^\s"'<>]+/,
  )
  if (!href) throw new Error('No verify link in email')
  return href[0].replace(/&amp;/g, '&')
}

async function followVerifyForHash(verifyUrl) {
  const res = await fetch(verifyUrl, { redirect: 'manual' })
  const location = res.headers.get('location')
  if (!location) throw new Error(`verify missing Location (HTTP ${res.status})`)
  return location
}

async function startVite() {
  writeFileSync(
    path.join(root, '.env.local'),
    [
      `VITE_SUPABASE_URL=${SUPABASE_URL}`,
      `VITE_SUPABASE_ANON_KEY=${ANON_KEY}`,
      '',
    ].join('\n'),
  )

  const child = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '5173'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      VITE_SUPABASE_URL: SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: ANON_KEY,
    },
  })

  let ready = false
  const onData = (buf) => {
    const text = buf.toString()
    if (text.includes('Local:') || text.includes('5173')) ready = true
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)

  const start = Date.now()
  while (!ready && Date.now() - start < 45000) {
    await sleep(200)
  }
  if (!ready) {
    child.kill('SIGTERM')
    throw new Error('Vite failed to start')
  }
  return child
}

async function main() {
  mkdirSync(ARTIFACT_DIR, { recursive: true })
  console.log('Password reset browser E2E')

  const mailbox = await createMailbox()
  const email = mailbox.address
  console.log('email:', email)

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  console.log('1) Sign up test user')
  const { data: signedUp, error: signUpError } = await client.auth.signUp({
    email,
    password: initialPassword,
  })
  if (signUpError) throw signUpError
  console.log('   user id:', signedUp.user?.id)

  console.log('2) Confirm email via mailbox link')
  const confirmMail = await waitForSubject(mailbox.token, (s) => /confirm/i.test(s))
  const confirmLink = extractVerifyLink(confirmMail)
  const confirmLoc = await followVerifyForHash(confirmLink)
  if (!confirmLoc.includes('access_token=')) {
    throw new Error(`confirm Location unexpected: ${confirmLoc.slice(0, 160)}`)
  }
  console.log('   confirmed')

  {
    const { error } = await client.auth.signInWithPassword({
      email,
      password: initialPassword,
    })
    if (error) throw new Error(`pre-reset login failed: ${error.message}`)
    await client.auth.signOut()
  }

  console.log('3) Request password reset (apex /reset-password redirect)')
  await sleep(45000)
  const recoverUrl = new URL('/auth/v1/recover', SUPABASE_URL)
  recoverUrl.searchParams.set('redirect_to', RESET_REDIRECT)
  const recoverRes = await fetch(recoverUrl, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })
  if (!recoverRes.ok) {
    throw new Error(`recover HTTP ${recoverRes.status}: ${await recoverRes.text()}`)
  }

  console.log('4) Receive reset email')
  const resetMail = await waitForSubject(mailbox.token, (s) => /reset your password/i.test(s))
  const resetLink = extractVerifyLink(resetMail)
  writeFileSync(
    path.join(ARTIFACT_DIR, 'reset-email.txt'),
    [
      `to: ${email}`,
      `from: ${resetMail.from?.address || resetMail.from}`,
      `subject: ${resetMail.subject}`,
      `verify: ${resetLink}`,
      '',
      resetMail.text || '',
      '',
      ...(resetMail.html || []),
    ].join('\n'),
  )
  if (
    !resetLink.includes('redirect_to=https%3A%2F%2Fcreatorexec.app%2Freset-password') &&
    !resetLink.includes('redirect_to=https://creatorexec.app/reset-password')
  ) {
    throw new Error(`Reset link missing allowlisted redirect: ${resetLink}`)
  }
  console.log('   got reset link with /reset-password redirect')

  console.log('5) Exchange verify link for recovery hash')
  const recoveryLocation = await followVerifyForHash(resetLink)
  if (!recoveryLocation.includes('type=recovery')) {
    throw new Error(`Expected type=recovery in ${recoveryLocation.slice(0, 200)}`)
  }
  const hash = recoveryLocation.includes('#')
    ? recoveryLocation.slice(recoveryLocation.indexOf('#'))
    : ''
  if (!hash.includes('access_token=')) {
    throw new Error('Recovery Location missing access_token hash')
  }
  writeFileSync(
    path.join(ARTIFACT_DIR, 'recovery-location.txt'),
    recoveryLocation.replace(/access_token=[^&]+/, 'access_token=REDACTED'),
  )

  console.log('6) Start local app and set password in browser')
  const vite = await startVite()
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const localResetUrl = `http://127.0.0.1:5173/reset-password${hash}`
    await page.goto(localResetUrl, { waitUntil: 'networkidle' })
    await page.waitForSelector('#reset-password', { timeout: 20000 })
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, '01-reset-form.png'),
      fullPage: true,
    })

    await page.fill('#reset-password', newPassword)
    await page.fill('#reset-confirm-password', newPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/login/, { timeout: 20000 })
    await page.waitForSelector('text=Password updated', { timeout: 10000 })
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, '02-login-after-reset.png'),
      fullPage: true,
    })
    console.log('   reset form → login success banner')

    console.log('7) Log in with new password in browser')
    await page.fill('#login-email', email)
    await page.fill('#login-password', newPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(app|subscribe)/, { timeout: 20000 })
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, '03-logged-in.png'),
      fullPage: true,
    })
    console.log('   logged in at', page.url())
  } finally {
    await browser.close()
    vite.kill('SIGTERM')
  }

  console.log('8) API confirm: old password rejected, new accepted')
  {
    const { error: oldErr } = await client.auth.signInWithPassword({
      email,
      password: initialPassword,
    })
    if (!oldErr) throw new Error('Old password still worked')
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password: newPassword,
    })
    if (error || !data.session) {
      throw new Error(`New password login failed: ${error?.message}`)
    }
  }

  console.log('PASS password reset E2E')
  console.log(`Artifacts: ${ARTIFACT_DIR}`)
}

main().catch((error) => {
  console.error('FAIL', error)
  process.exit(1)
})

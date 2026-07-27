/**
 * Unit checks for password-reset redirect helpers + live Supabase recover probe.
 *
 * Usage:
 *   npx tsx scripts/verify-password-reset.ts
 *
 * Optional live email probe (Mailinator):
 *   LIVE_PASSWORD_RESET_PROBE=1 npx tsx scripts/verify-password-reset.ts
 */
import assert from 'node:assert/strict'
import {
  getPasswordResetRedirectTo,
  hasPasswordRecoveryInUrl,
  PRODUCTION_PASSWORD_RESET_REDIRECT,
} from '../src/lib/auth/passwordReset.ts'

function testRedirectHelpers() {
  assert.equal(
    getPasswordResetRedirectTo('https://www.creatorexec.app'),
    PRODUCTION_PASSWORD_RESET_REDIRECT,
  )
  assert.equal(
    getPasswordResetRedirectTo('https://creatorexec.app'),
    PRODUCTION_PASSWORD_RESET_REDIRECT,
  )
  assert.equal(
    getPasswordResetRedirectTo('http://localhost:5173'),
    'http://localhost:5173/reset-password',
  )
  assert.equal(
    hasPasswordRecoveryInUrl({
      hash: '#access_token=abc&type=recovery&refresh_token=x',
      search: '',
    }),
    true,
  )
  assert.equal(
    hasPasswordRecoveryInUrl({ hash: '#type=signup', search: '' }),
    false,
  )
  console.log('PASS  redirect + recovery URL helpers')
}

async function liveProbe() {
  if (process.env.LIVE_PASSWORD_RESET_PROBE !== '1') {
    console.log('SKIP  live recover probe (set LIVE_PASSWORD_RESET_PROBE=1)')
    return
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error('Need SUPABASE_URL/VITE_SUPABASE_URL and anon key for live probe')
  }

  const redirectTo = PRODUCTION_PASSWORD_RESET_REDIRECT
  const email = `ce-reset-verify-${Date.now()}@mailinator.com`
  const recoverUrl = new URL('/auth/v1/recover', url)
  recoverUrl.searchParams.set('redirect_to', redirectTo)

  const response = await fetch(recoverUrl, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })
  assert.equal(response.status, 200, `recover HTTP ${response.status}`)
  console.log(`PASS  live recover accepted for ${email} redirect_to=${redirectTo}`)
}

testRedirectHelpers()
liveProbe().catch((error) => {
  console.error(error)
  process.exit(1)
})

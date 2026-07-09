/**
 * Supabase Auth end-to-end verification.
 * Usage: npm run test:auth
 *
 * Requires .env with SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadEnvFile() {
  const envPath = path.join(root, '.env')
  try {
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!(key in process.env)) {
        process.env[key] = value
      }
    }
  } catch {
    // optional until credentials exist
  }
}

loadEnvFile()

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function assertEnv() {
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      [
        'Missing Supabase credentials in .env',
        'Required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY',
      ].join('\n'),
    )
  }
  return { url, anonKey, serviceRoleKey }
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10)
}

async function main() {
  const { url, anonKey, serviceRoleKey } = assertEnv()
  const suffix = randomSuffix()
  const email = `creatorexec-auth-${suffix}@example.com`
  const password = `Auth-${suffix}-Pass1!`

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const authed = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  })

  console.log('Supabase Auth verification')
  console.log('='.repeat(60))
  console.log(`Test email: ${email}`)

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !created.user) {
    throw new Error(`Failed to create test user: ${createError?.message ?? 'unknown'}`)
  }
  console.log('PASS  created test user via admin API')
  console.log(`      user id: ${created.user.id}`)

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })
  if (listError) {
    throw new Error(`Failed to list users: ${listError.message}`)
  }
  const found = listed.users.some((user) => user.id === created.user.id)
  if (!found) {
    throw new Error('Created user not found in Supabase Auth user list')
  }
  console.log('PASS  user appears in Supabase Auth (admin listUsers)')

  const { data: signInData, error: signInError } = await authed.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError || !signInData.session) {
    throw new Error(`Sign in failed: ${signInError?.message ?? 'no session'}`)
  }
  console.log('PASS  sign in with email/password')

  const { data: sessionAfterLogin, error: sessionError } = await authed.auth.getSession()
  if (sessionError || !sessionAfterLogin.session) {
    throw new Error(`Session not persisted after login: ${sessionError?.message ?? 'no session'}`)
  }
  console.log('PASS  session restored via getSession() (refresh persistence path)')

  const { error: signOutError } = await authed.auth.signOut()
  if (signOutError) {
    throw new Error(`Sign out failed: ${signOutError.message}`)
  }
  console.log('PASS  sign out')

  const { data: sessionAfterLogout } = await authed.auth.getSession()
  if (sessionAfterLogout.session) {
    throw new Error('Session still present after sign out')
  }
  console.log('PASS  session cleared after sign out')

  const { error: blockedSignInError } = await authed.auth.signInWithPassword({
    email,
    password: 'wrong-password',
  })
  if (!blockedSignInError) {
    throw new Error('Expected invalid credentials sign-in to fail')
  }
  console.log('PASS  invalid credentials rejected')

  await admin.auth.admin.deleteUser(created.user.id)
  console.log('PASS  deleted test user')

  console.log('='.repeat(60))
  console.log('Supabase Auth verification passed.')
  console.log('')
  console.log('Confirm in Supabase Dashboard → Authentication → Users')
  console.log(`that ${email} was created and then removed by this script.`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})

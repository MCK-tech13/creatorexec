/**
 * Support tool: set a user's password or generate a recovery link.
 *
 * Use when a customer cannot log in and you need to help without relying
 * on inbound support email.
 *
 * Requires .env with:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Examples:
 *   npm run set-password -- user@email.com 'TempPass123!'
 *   npm run set-password -- user@email.com --link
 *   npm run set-password -- --lookup user@email.com
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const DEFAULT_SITE_URL = 'https://www.creatorexec.app'
const MIN_PASSWORD_LENGTH = 6

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

function printUsage() {
  console.log(`Usage:
  npm run set-password -- <email> <new-password>
  npm run set-password -- <email> --link
  npm run set-password -- --lookup <email>

Options:
  --link              Generate a password-recovery URL (text/DM it to the user)
  --lookup            Show the auth user record for an email (no password change)
  --site-url <url>    Redirect base for recovery links (default: ${DEFAULT_SITE_URL})
  --help              Show this help

Examples:
  npm run set-password -- creator@example.com 'TempPass123!'
  npm run set-password -- creator@example.com --link
  npm run set-password -- --lookup creator@example.com

Requires SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.`)
}

function parseArgs(argv) {
  const args = argv.slice(2)
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { help: true }
  }

  let link = false
  let lookup = false
  let siteUrl = process.env.APP_URL || DEFAULT_SITE_URL
  const positionals = []

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--link') {
      link = true
      continue
    }
    if (arg === '--lookup') {
      lookup = true
      continue
    }
    if (arg === '--site-url') {
      const next = args[i + 1]
      if (!next || next.startsWith('--')) {
        throw new Error('--site-url requires a value')
      }
      siteUrl = next
      i += 1
      continue
    }
    if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`)
    }
    positionals.push(arg)
  }

  if (lookup) {
    const email = positionals[0]
    if (!email) {
      throw new Error('Lookup requires an email: npm run set-password -- --lookup user@email.com')
    }
    return { lookup: true, email: email.trim().toLowerCase(), siteUrl }
  }

  const email = positionals[0]
  if (!email) {
    throw new Error('Email is required. Run with --help for usage.')
  }

  if (link) {
    return { link: true, email: email.trim().toLowerCase(), siteUrl }
  }

  const password = positionals[1] ?? null
  return {
    setPassword: true,
    email: email.trim().toLowerCase(),
    password,
    siteUrl,
  }
}

function assertEnv() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error(
      [
        'Missing Supabase credentials in .env',
        'Required: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY',
      ].join('\n'),
    )
  }
  return { url, serviceRoleKey }
}

async function createAdminClient(url, serviceRoleKey) {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function findUserByEmail(admin, email) {
  const normalized = email.trim().toLowerCase()
  let page = 1
  const perPage = 200

  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(`Failed to list users: ${error.message}`)
    }
    const users = data?.users ?? []
    const match = users.find((user) => (user.email ?? '').toLowerCase() === normalized)
    if (match) return match
    if (users.length < perPage) break
    page += 1
  }

  return null
}

async function promptPassword(email) {
  if (!input.isTTY) {
    throw new Error(
      `Password required. Pass it as the second argument:\n  npm run set-password -- ${email} 'NewPassword123!'`,
    )
  }

  const rl = readline.createInterface({ input, output })
  try {
    const password = await rl.question(`New password for ${email}: `)
    const confirm = await rl.question('Confirm password: ')
    if (password !== confirm) {
      throw new Error('Passwords do not match.')
    }
    return password
  } finally {
    rl.close()
  }
}

function printUserSummary(user) {
  console.log(`Email:     ${user.email}`)
  console.log(`User id:   ${user.id}`)
  console.log(`Confirmed: ${user.email_confirmed_at ? 'yes' : 'no'}`)
  console.log(`Created:   ${user.created_at ?? 'unknown'}`)
  console.log(`Last sign: ${user.last_sign_in_at ?? 'never'}`)
}

async function main() {
  let options
  try {
    options = parseArgs(process.argv)
  } catch (error) {
    console.error(error.message)
    console.error('')
    printUsage()
    process.exit(1)
  }

  if (options.help) {
    printUsage()
    return
  }

  const { url, serviceRoleKey } = assertEnv()
  const admin = await createAdminClient(url, serviceRoleKey)

  console.log('CreatorExec support — password tool')
  console.log('='.repeat(60))

  if (options.lookup) {
    const user = await findUserByEmail(admin, options.email)
    if (!user) {
      throw new Error(`No auth user found for ${options.email}`)
    }
    printUserSummary(user)
    return
  }

  if (options.link) {
    const redirectTo = new URL('/reset-password', options.siteUrl).toString()
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: options.email,
      options: { redirectTo },
    })
    if (error) {
      throw new Error(`Failed to generate recovery link: ${error.message}`)
    }

    const actionLink = data?.properties?.action_link
    if (!actionLink) {
      throw new Error('Supabase did not return an action_link for this user.')
    }

    const user = data.user ?? (await findUserByEmail(admin, options.email))
    if (user) printUserSummary(user)
    console.log('')
    console.log('Recovery link (send via text/DM — expires per Supabase settings):')
    console.log(actionLink)
    console.log('')
    console.log(`Redirect after click: ${redirectTo}`)
    return
  }

  let password = options.password
  if (!password) {
    password = await promptPassword(options.email)
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }

  const user = await findUserByEmail(admin, options.email)
  if (!user) {
    throw new Error(`No auth user found for ${options.email}`)
  }

  const { data, error } = await admin.auth.admin.updateUserById(user.id, {
    password,
  })
  if (error || !data.user) {
    throw new Error(`Failed to update password: ${error?.message ?? 'unknown error'}`)
  }

  printUserSummary(data.user)
  console.log('')
  console.log('Password updated. Tell the user the temporary password out of band')
  console.log('(text/DM), then ask them to log in and change it at /reset-password')
  console.log('while signed in, or use Forgot password once email delivery works.')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})

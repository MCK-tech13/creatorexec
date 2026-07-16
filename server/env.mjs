import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Load .env from repo root. File values win over empty process.env entries. */
export function loadEnvFile() {
  const envPath = path.join(root, '.env')
  if (!existsSync(envPath)) {
    return { loaded: false, path: envPath, keys: [] }
  }

  const loadedKeys = []
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    const existing = process.env[key]
    if (existing === undefined || existing === '') {
      process.env[key] = value
      loadedKeys.push(key)
    }
  }

  return { loaded: true, path: envPath, keys: loadedKeys }
}

function maskSecret(value, visiblePrefix = 8) {
  if (!value) return 'MISSING'
  if (value.length <= visiblePrefix) return `${value} (short)`
  return `${value.slice(0, visiblePrefix)}… (${value.length} chars)`
}

export function getServerEnv() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || null
  const stripeBetaPriceId = process.env.STRIPE_BETA_PRICE_ID
  const resendApiKey = process.env.RESEND_API_KEY?.trim() || null
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim() || null
  const tiktokClientKey = process.env.TIKTOK_CLIENT_KEY?.trim() || null
  const tiktokClientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim() || null
  const tiktokRedirectUri =
    process.env.TIKTOK_REDIRECT_URI?.trim() ||
    'https://www.creatorexec.app/api/tiktok/oauth/callback'
  const tiktokOAuthStateSecret =
    process.env.TIKTOK_OAUTH_STATE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null
  const appUrl =
    process.env.APP_URL ??
    process.env.VITE_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')
  const port = Number(process.env.STRIPE_API_PORT ?? 4242)

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    stripeSecretKey,
    stripeWebhookSecret,
    stripeBetaPriceId,
    resendApiKey,
    anthropicApiKey,
    tiktokClientKey,
    tiktokClientSecret,
    tiktokRedirectUri,
    tiktokOAuthStateSecret,
    appUrl,
    port,
  }
}

export function assertBillingEnv() {
  const env = getServerEnv()
  const missing = []
  if (!env.supabaseUrl) missing.push('SUPABASE_URL')
  if (!env.supabaseAnonKey) missing.push('SUPABASE_ANON_KEY')
  if (!env.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!env.stripeSecretKey) missing.push('STRIPE_SECRET_KEY')
  if (!env.stripeBetaPriceId) missing.push('STRIPE_BETA_PRICE_ID')
  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(', ')}`)
  }
  return env
}

export function getWebhookEnvStatus(env = getServerEnv()) {
  const secret = env.stripeWebhookSecret
  return {
    configured: Boolean(secret),
    prefix: secret ? secret.slice(0, 6) : null,
    looksLikeCliSecret: secret?.startsWith('whsec_') ?? false,
    length: secret?.length ?? 0,
  }
}

export function logServerStartup(env, envFileResult) {
  const webhook = getWebhookEnvStatus(env)

  console.log('[billing-api] Starting Stripe billing API')
  console.log(`[billing-api] .env: ${envFileResult.loaded ? envFileResult.path : 'not found'}`)
  if (envFileResult.loaded && envFileResult.keys.length > 0) {
    console.log(`[billing-api] loaded from .env: ${envFileResult.keys.join(', ')}`)
  }
  console.log('[billing-api] Environment check:')
  console.log(`  SUPABASE_URL: ${env.supabaseUrl ? 'set' : 'MISSING'}`)
  console.log(`  SUPABASE_ANON_KEY: ${maskSecret(env.supabaseAnonKey)}`)
  console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${maskSecret(env.supabaseServiceRoleKey)}`)
  console.log(`  STRIPE_SECRET_KEY: ${maskSecret(env.stripeSecretKey)}`)
  console.log(`  STRIPE_BETA_PRICE_ID: ${env.stripeBetaPriceId ?? 'MISSING'}`)
  console.log(`  RESEND_API_KEY: ${env.resendApiKey ? maskSecret(env.resendApiKey) : 'MISSING'}`)
  console.log(
    `  ANTHROPIC_API_KEY: ${env.anthropicApiKey ? maskSecret(env.anthropicApiKey) : 'MISSING'}`,
  )
  console.log(
    `  TIKTOK_CLIENT_KEY: ${env.tiktokClientKey ? maskSecret(env.tiktokClientKey, 4) : 'MISSING'}`,
  )
  console.log(
    `  TIKTOK_CLIENT_SECRET: ${env.tiktokClientSecret ? maskSecret(env.tiktokClientSecret) : 'MISSING'}`,
  )
  console.log(`  TIKTOK_REDIRECT_URI: ${env.tiktokRedirectUri}`)
  console.log(
    `  TIKTOK_OAUTH_STATE_SECRET: ${env.tiktokOAuthStateSecret ? 'set' : 'MISSING (falls back to CRON_SECRET)'}`,
  )
  console.log(`  APP_URL: ${env.appUrl}`)
  console.log(
    `  STRIPE_WEBHOOK_SECRET: ${webhook.configured ? maskSecret(env.stripeWebhookSecret) : 'MISSING'}`,
  )

  if (!webhook.configured) {
    console.warn(
      '[billing-api] WARNING: STRIPE_WEBHOOK_SECRET is missing. All /api/stripe/webhook requests will return 500.',
    )
    console.warn(
      '[billing-api] Run: stripe listen --forward-to localhost:4242/api/stripe/webhook',
    )
    console.warn('[billing-api] Copy the whsec_… secret into .env and restart this server.')
  } else if (!webhook.looksLikeCliSecret) {
    console.warn(
      '[billing-api] WARNING: STRIPE_WEBHOOK_SECRET does not start with whsec_. For local dev, use the secret printed by `stripe listen`, not the Dashboard endpoint secret.',
    )
  }
}

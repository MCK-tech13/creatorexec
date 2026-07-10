import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function loadEnvFile() {
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

export function getServerEnv() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const stripeBetaPriceId = process.env.STRIPE_BETA_PRICE_ID
  const appUrl = process.env.APP_URL ?? process.env.VITE_APP_URL ?? 'http://localhost:5173'
  const port = Number(process.env.STRIPE_API_PORT ?? 4242)

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    stripeSecretKey,
    stripeWebhookSecret,
    stripeBetaPriceId,
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

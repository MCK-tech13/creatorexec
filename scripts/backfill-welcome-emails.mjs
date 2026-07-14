/**
 * One-off: list / send branded welcome emails to ALL currently active beta subscribers.
 *
 * ALWAYS dry-runs first (list only). Sends ONLY when SEND_WELCOME_EMAILS=1.
 *
 * Required env (via .env or shell):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   STRIPE_SECRET_KEY, STRIPE_BETA_PRICE_ID (for plan display + pricing when sending)
 *   RESEND_API_KEY (only when sending)
 *   APP_URL (optional; defaults to https://www.creatorexec.app)
 *
 * Usage:
 *   # 1) List candidates — review BEFORE sending
 *   npm run backfill:welcome-emails
 *
 *   # 2) After you approve the printed list:
 *   SEND_WELCOME_EMAILS=1 npm run backfill:welcome-emails
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'
import { loadEnvFile, getServerEnv } from '../server/env.mjs'
import { getSupabaseAdmin } from '../server/supabaseAdmin.mjs'
import {
  buildWelcomeEmailHtml,
  buildWelcomeEmailText,
  extractPlanPricing,
  sendWelcomeEmailViaResend,
} from '../server/emails/welcomeEmail.mjs'

loadEnvFile()

const isCliEntry =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

const ACTIVE_STATUSES = new Set(['active', 'trialing'])

/** Explicit emails we never backfill (internal / operator testing). */
const EXCLUDED_EMAILS = new Set(['mckcreativegroup@gmail.com'].map((e) => e.toLowerCase()))

/**
 * Heuristics for test / synthetic accounts (plus explicit exclusions above).
 * Real beta users (including personal founder addresses) are kept for your review.
 */
export function isExcludedTestEmail(email) {
  if (!email || typeof email !== 'string') return true
  const normalized = email.trim().toLowerCase()
  if (!normalized.includes('@')) return true
  if (EXCLUDED_EMAILS.has(normalized)) return true

  const [local = '', domain = ''] = normalized.split('@')

  if (domain === 'example.com' || domain === 'test.com' || domain.endsWith('.test')) {
    return true
  }

  // Automated test scripts in this repo
  if (local.startsWith('creatorexec-stripe-')) return true
  if (local.startsWith('creatorexec-auth-')) return true
  if (local.startsWith('creatorexec-billing-')) return true
  if (local.startsWith('creatorexec-phase3-')) return true

  // Plus-addressed test aliases: +test, +livetest, +prod1, +welcometest, etc.
  if (/\+(test|livetest|welcometest|prod\d*|qa|sandbox|internal)\b/i.test(local)) return true
  if (
    local.includes('+test') ||
    local.includes('+livetest') ||
    local.includes('+welcometest') ||
    local.includes('+prod')
  ) {
    return true
  }

  return false
}

async function listAuthUsers(admin) {
  /** @type {Array<{ id: string, email: string | null, created_at: string | null, user_metadata?: Record<string, unknown> }>} */
  const users = []
  let page = 1
  const perPage = 200

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`auth.admin.listUsers failed: ${error.message}`)
    const batch = data?.users ?? []
    for (const user of batch) {
      users.push({
        id: user.id,
        email: user.email ?? null,
        created_at: user.created_at ?? null,
        user_metadata: user.user_metadata ?? {},
      })
    }
    if (batch.length < perPage) break
    page += 1
    if (page > 100) break
  }

  return users
}

async function listActiveSubscriptions(admin) {
  const { data, error } = await admin
    .from('user_subscriptions')
    .select(
      'user_id, subscription_status, stripe_customer_id, stripe_subscription_id, price_id, created_at, updated_at',
    )
    .in('subscription_status', [...ACTIVE_STATUSES])

  if (error) throw new Error(`user_subscriptions query failed: ${error.message}`)
  return data ?? []
}

async function resolvePricing(stripe, subscriptionId, fallbackPriceId) {
  if (stripe && subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price'],
      })
      return extractPlanPricing({ subscription })
    } catch (error) {
      console.warn(
        `[backfill] Stripe subscription retrieve failed (${subscriptionId}):`,
        error instanceof Error ? error.message : error,
      )
    }
  }

  if (stripe && fallbackPriceId) {
    try {
      const price = await stripe.prices.retrieve(fallbackPriceId)
      return extractPlanPricing({
        subscription: { items: { data: [{ price }] }, metadata: { price_id: fallbackPriceId } },
      })
    } catch (error) {
      console.warn(
        `[backfill] Stripe price retrieve failed (${fallbackPriceId}):`,
        error instanceof Error ? error.message : error,
      )
    }
  }

  return extractPlanPricing({
    subscription: {
      items: {
        data: [
          {
            price: {
              id: process.env.STRIPE_BETA_PRICE_ID ?? null,
              unit_amount: null,
              currency: 'usd',
              recurring: { interval: 'month', interval_count: 1 },
            },
          },
        ],
      },
    },
  })
}

function displayNameFromUser(user) {
  const meta = user?.user_metadata ?? {}
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    null
  return fullName
}

async function main() {
  const send = process.env.SEND_WELCOME_EMAILS === '1'
  const env = getServerEnv()

  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }
  if (send) {
    if (!env.resendApiKey) throw new Error('SEND_WELCOME_EMAILS=1 requires RESEND_API_KEY')
    if (!env.stripeSecretKey) throw new Error('SEND_WELCOME_EMAILS=1 requires STRIPE_SECRET_KEY')
  }

  const admin = getSupabaseAdmin(env.supabaseUrl, env.supabaseServiceRoleKey)
  const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null

  console.log('Welcome email backfill')
  console.log('='.repeat(60))
  console.log(`Mode: ${send ? 'SEND (live)' : 'DRY RUN (list only — nothing will be emailed)'}`)
  console.log(`Audience: ALL active/trialing subscribers (no date cutoff)`)
  console.log(`Statuses: ${[...ACTIVE_STATUSES].join(', ')}`)
  console.log('')

  const [subs, authUsers] = await Promise.all([
    listActiveSubscriptions(admin),
    listAuthUsers(admin),
  ])

  const usersById = new Map(authUsers.map((u) => [u.id, u]))

  /** @type {Array<Record<string, unknown>>} */
  const candidates = []
  /** @type {Array<Record<string, unknown>>} */
  const excluded = []

  for (const sub of subs) {
    const user = usersById.get(sub.user_id)
    const email = user?.email ?? null

    const base = {
      user_id: sub.user_id,
      email,
      subscription_status: sub.subscription_status,
      stripe_subscription_id: sub.stripe_subscription_id,
      price_id: sub.price_id,
      subscription_created_at: sub.created_at,
      auth_created_at: user?.created_at ?? null,
    }

    if (!email) {
      excluded.push({ ...base, reason: 'missing email on auth.users' })
      continue
    }
    if (isExcludedTestEmail(email)) {
      excluded.push({ ...base, reason: 'test/internal email filter' })
      continue
    }
    if (!user) {
      excluded.push({ ...base, reason: 'no matching auth.users row' })
      continue
    }

    candidates.push({
      ...base,
      name: displayNameFromUser(user),
    })
  }

  candidates.sort((a, b) => String(a.email).localeCompare(String(b.email)))

  console.log(`Active/trialing rows: ${subs.length}`)
  console.log(`Auth users loaded: ${authUsers.length}`)
  console.log(`Excluded: ${excluded.length}`)
  console.log(`CANDIDATES TO EMAIL: ${candidates.length}`)
  console.log('')
  console.log('--- APPROVAL LIST (emails that WOULD be emailed) ---')
  if (candidates.length === 0) {
    console.log('(none)')
  } else {
    for (const [index, row] of candidates.entries()) {
      console.log(
        `${String(index + 1).padStart(2, ' ')}. ${row.email}` +
          `  | status=${row.subscription_status}` +
          `  | sub_created=${row.subscription_created_at ?? 'n/a'}` +
          `  | user_id=${row.user_id}`,
      )
    }
  }
  console.log('--- END APPROVAL LIST ---')
  console.log('')

  if (excluded.length > 0) {
    console.log('Excluded (for transparency):')
    for (const row of excluded) {
      console.log(`  - ${row.email ?? '(no email)'} | ${row.reason}`)
    }
    console.log('')
  }

  if (!send) {
    console.log('Dry run complete. Nothing was sent.')
    console.log('After you approve the list, re-run with:')
    console.log('  SEND_WELCOME_EMAILS=1 npm run backfill:welcome-emails')
    return
  }

  console.log('Sending welcome emails…')
  /** @type {Array<{ email: string, ok: boolean, id?: string | null, error?: string }>} */
  const results = []

  for (const row of candidates) {
    const pricing = await resolvePricing(
      stripe,
      typeof row.stripe_subscription_id === 'string' ? row.stripe_subscription_id : null,
      typeof row.price_id === 'string' ? row.price_id : env.stripeBetaPriceId ?? null,
    )

    const mail = {
      recipientName: typeof row.name === 'string' ? row.name : null,
      recipientEmail: String(row.email),
      appUrl: env.appUrl || 'https://www.creatorexec.app',
      planDisplayName: pricing.planDisplayName,
      amountLabel: pricing.amountLabel,
      intervalLabel: pricing.intervalLabel,
    }

    try {
      const result = await sendWelcomeEmailViaResend({
        apiKey: env.resendApiKey,
        to: mail.recipientEmail,
        html: buildWelcomeEmailHtml(mail),
        text: buildWelcomeEmailText(mail),
      })

      if (result.ok) {
        console.log(
          `OK  ${mail.recipientEmail}  plan=${pricing.planDisplayName} ${pricing.amountLabel} id=${result.id}`,
        )
        results.push({ email: mail.recipientEmail, ok: true, id: result.id })
      } else {
        console.error(`FAIL ${mail.recipientEmail}  ${result.error}`)
        results.push({ email: mail.recipientEmail, ok: false, error: result.error })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`FAIL ${mail.recipientEmail}  ${message}`)
      results.push({ email: mail.recipientEmail, ok: false, error: message })
    }

    await new Promise((r) => setTimeout(r, 250))
  }

  const okCount = results.filter((r) => r.ok).length
  const failCount = results.length - okCount
  console.log('')
  console.log('='.repeat(60))
  console.log(`Done. sent_ok=${okCount} failed=${failCount} total=${results.length}`)
  if (failCount > 0) {
    console.log('Failures:')
    for (const row of results.filter((r) => !r.ok)) {
      console.log(`  - ${row.email}: ${row.error}`)
    }
    process.exitCode = 1
  }
}

if (isCliEntry) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}

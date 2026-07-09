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
    // .env is optional until credentials are provided
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
        'Required: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY), SUPABASE_SERVICE_ROLE_KEY',
        'Copy .env.example to .env and paste values from Supabase Dashboard > Settings > API',
      ].join('\n'),
    )
  }

  return { url, anonKey, serviceRoleKey }
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10)
}

async function createTestUser(adminClient, label) {
  const email = `creatorexec-${label}-${randomSuffix()}@example.com`
  const password = `Test-${randomSuffix()}-Pass1!`

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || !data.user) {
    throw new Error(`Failed to create ${label} user: ${error?.message ?? 'unknown error'}`)
  }

  return { id: data.user.id, email, password }
}

async function signIn(url, anonKey, email, password, expectedUserId) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error(`Failed to sign in ${email}: ${error?.message ?? 'no session'}`)
  }

  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) {
    throw new Error(`Auth session invalid for ${email}: ${userError?.message ?? 'no user'}`)
  }

  if (userData.user.id !== expectedUserId) {
    throw new Error(
      `Signed-in user id mismatch for ${email}: expected ${expectedUserId}, got ${userData.user.id}`,
    )
  }

  if (!data.session.access_token) {
    throw new Error(`Missing access token after sign-in for ${email}`)
  }

  return { client, user: userData.user, session: data.session }
}

async function assertOk(promise, message) {
  const { data, error } = await promise
  if (error) {
    throw new Error(`${message}: ${error.message}`)
  }
  return data
}

async function assertDenied(promise, message) {
  const { data, error } = await promise
  if (error) {
    return
  }

  const hasData = Array.isArray(data) ? data.length > 0 : data != null
  if (hasData) {
    throw new Error(`${message}: expected RLS to hide rows, got ${JSON.stringify(data)}`)
  }
}

async function cleanup(adminClient, userIds) {
  for (const userId of userIds) {
    await adminClient.auth.admin.deleteUser(userId)
  }
}

async function main() {
  const { url, anonKey, serviceRoleKey } = assertEnv()
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const userA = await createTestUser(admin, 'user-a')
  const userB = await createTestUser(admin, 'user-b')

  const { client: clientA } = await signIn(url, anonKey, userA.email, userA.password, userA.id)
  const { client: clientB } = await signIn(url, anonKey, userB.email, userB.password, userB.id)

  try {
    const trialRow = await assertOk(
      clientA
        .from('trial_progress')
        .insert({
          user_id: userA.id,
          product_id: 'test-product-123',
          videos_filmed: 2,
          source: 'manual',
        })
        .select()
        .single(),
      'insert trial_progress as user A',
    )

    const ownTrial = await assertOk(
      clientA.from('trial_progress').select('*').eq('id', trialRow.id).single(),
      'read own trial_progress',
    )
    if (!ownTrial) throw new Error('own trial_progress read returned empty')

    await assertDenied(
      clientB.from('trial_progress').select('*').eq('id', trialRow.id).maybeSingle(),
      'user B must not read user A trial_progress',
    )

    const dealRow = await assertOk(
      clientA
        .from('retainer_deals')
        .insert({
          user_id: userA.id,
          brand_name: 'Test Brand',
          product: 'Sample SKU',
          stage: 'negotiating',
          is_retainer: true,
          retainer_total_videos: 4,
          filming_checklist: [],
          video_deliverables: [{ id: 'v1' }],
        })
        .select()
        .single(),
      'insert retainer_deals as user A',
    )

    await assertDenied(
      clientB.from('retainer_deals').select('*').eq('id', dealRow.id).maybeSingle(),
      'user B must not read user A retainer_deals',
    )

    await assertOk(
      clientA.from('income_entries').insert({
        user_id: userA.id,
        month_key: '2026-07',
        gmv_total: 12000,
        estimated_commission: 1800,
        settled_commission: 1500,
        brand_deals_income: 500,
        bonuses_rewards: 100,
      }),
      'insert income_entries as user A',
    )

    await assertDenied(
      clientB.from('income_entries').select('*').eq('month_key', '2026-07').maybeSingle(),
      'user B must not read user A income_entries',
    )

    await assertOk(
      clientA.from('product_scout_list').insert({
        user_id: userA.id,
        product_name: 'Scout Widget',
        metrics: {
          orders: { value: '120', delta: '10%' },
          ctr: { value: '2.1%', delta: '0.2%' },
          creators: { value: '45', delta: '5%' },
          atcUsers: { value: '300', delta: '12%' },
        },
        verdict: 'strong',
        total_score: 82,
        funnel_recommendation: { headline: 'TOF', detail: 'High demand' },
      }),
      'insert product_scout_list as user A',
    )

    await assertDenied(
      clientB
        .from('product_scout_list')
        .select('*')
        .eq('product_name', 'Scout Widget')
        .maybeSingle(),
      'user B must not read user A product_scout_list',
    )

    await assertOk(
      clientA.from('onboarding_state').insert({
        user_id: userA.id,
        completed: true,
        mode: 'beginner',
        videos_per_day: 5,
        monthly_commission: 'growing',
        filming_approach: 'rough_system',
        welcome_seen: true,
        sprint_entry_seen: false,
      }),
      'insert onboarding_state as user A',
    )

    await assertDenied(
      clientB.from('onboarding_state').select('*').eq('user_id', userA.id).maybeSingle(),
      'user B must not read user A onboarding_state',
    )

    await assertOk(
      clientA.from('sprint_history').insert({
        user_id: userA.id,
        started_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        ended_at: new Date().toISOString(),
        file_name: 'commission-report.csv',
        schedule_mode: 'full',
        videos_per_day: 5,
        sprint_days: 7,
        start_total_commission: 1000,
        end_total_commission: 1500,
        commission_delta: 500,
        commission_percent_change: 50,
        start_snapshot: { products: [] },
        end_snapshot: {
          products: [
            {
              key: 'p1',
              id: 'p1',
              productId: 'p1',
              productName: 'Widget',
              commission: 1500,
              tier: 'Anchor',
              videosFilmed: 3,
            },
          ],
        },
        tier_movements: [
          { productName: 'Widget', previousTier: 'Rising', newTier: 'Anchor' },
        ],
        trial_completions: [],
        top_performer: null,
        trials_in_progress: 1,
      }),
      'insert sprint_history as user A',
    )

    await assertDenied(
      clientB
        .from('sprint_history')
        .select('*')
        .eq('file_name', 'commission-report.csv')
        .maybeSingle(),
      'user B must not read user A sprint_history',
    )

    console.log('Supabase foundation test passed: inserts, own reads, and cross-user RLS denials verified.')
  } finally {
    await cleanup(admin, [userA.id, userB.id])
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})

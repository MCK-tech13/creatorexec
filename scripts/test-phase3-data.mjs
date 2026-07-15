/**
 * Phase 3: Supabase user data migration + persistence verification.
 * Usage: npm run test:phase3
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

function migrationFlagKey(userId) {
  return `creatorexec-supabase-migrated-${userId}`
}

function installLocalStoragePolyfill() {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value))
    },
    removeItem: (key) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  return store
}

async function createTestUser(admin, label) {
  const email = `creatorexec-phase3-${label}-${randomSuffix()}@example.com`
  const password = `Phase3-${randomSuffix()}-Pass1!`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    throw new Error(`Failed to create ${label} user: ${error?.message ?? 'unknown'}`)
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
  if (userError || userData.user?.id !== expectedUserId) {
    throw new Error(`Auth session invalid for ${email}`)
  }
  return client
}

async function assertOk(promise, message) {
  const { data, error } = await promise
  if (error) throw new Error(`${message}: ${error.message}`)
  return data
}

async function dumpUserTables(admin, userId, label) {
  const tables = [
    'trial_progress',
    'retainer_deals',
    'income_entries',
    'product_scout_list',
    'onboarding_state',
    'sprint_history',
    'current_sprint_state',
  ]

  console.log(`\n--- Supabase rows for ${label} (${userId}) ---`)
  for (const table of tables) {
    const { data, error } = await admin.from(table).select('*').eq('user_id', userId)
    if (error) {
      console.log(`${table}: ERROR ${error.message}`)
      continue
    }
    console.log(`${table} (${data.length} row(s)):`)
    console.log(JSON.stringify(data, null, 2))
  }
}

const sampleProductScoutEntry = {
  id: '11111111-1111-4111-8111-111111111111',
  productName: 'Vitamin C Serum',
  metrics: {
    orders: { value: '12.4K', delta: '+18%' },
    ctr: { value: '3.2%', delta: '+0.4%' },
    creators: { value: '840', delta: '-6%' },
    atcUsers: { value: '2.1K', delta: '+12%' },
  },
  createdAt: '2026-07-09T12:00:00.000Z',
  updatedAt: '2026-07-09T12:00:00.000Z',
}

const sampleBrandDeal = {
  id: '22222222-2222-4222-8222-222222222222',
  brandName: 'Glow Labs',
  product: 'Night Cream',
  stage: 'filming',
  contractSigned: true,
  videoDeliverables: [{ id: 'vid-1' }],
  isRetainer: true,
  retainerTotalVideos: 4,
  filmingChecklist: [{ id: 'fc-1', completed: false }],
  createdAt: '2026-07-09T12:00:00.000Z',
  updatedAt: '2026-07-09T12:00:00.000Z',
}

async function migrateLocalStorageToSupabase(client, userId, localStore) {
  if (localStore.get(migrationFlagKey(userId)) === 'true') return

  const hasLocal =
    localStore.get('creatorexec-trial-progress') ||
    localStore.get('creatorexec-brand-deals') ||
    localStore.get('creatorexec-income-tracker') ||
    localStore.get('creatorexec-product-scout') ||
    localStore.get('creatorexec-onboarding')

  if (!hasLocal) {
    localStore.set(migrationFlagKey(userId), 'true')
    return
  }

  const trial = JSON.parse(localStore.get('creatorexec-trial-progress') ?? '{}')
  for (const [productId, entry] of Object.entries(trial)) {
    await assertOk(
      client.from('trial_progress').upsert(
        {
          user_id: userId,
          product_id: productId,
          videos_filmed: entry.videosFilmed ?? 0,
          source: entry.source ?? null,
        },
        { onConflict: 'user_id,product_id' },
      ),
      'migrate trial_progress',
    )
  }

  const deals = JSON.parse(localStore.get('creatorexec-brand-deals') ?? '[]')
  if (deals.length > 0) {
    await assertOk(
      client.from('retainer_deals').upsert(
        deals.map((deal) => ({
          id: deal.id,
          user_id: userId,
          brand_name: deal.brandName,
          product: deal.product ?? '',
          stage: deal.stage,
          contract_signed: deal.contractSigned ?? false,
          video_deliverables: deal.videoDeliverables ?? [],
          is_retainer: deal.isRetainer ?? false,
          filming_checklist: deal.filmingChecklist ?? [],
          created_at: deal.createdAt,
          updated_at: deal.updatedAt,
        })),
      ),
      'migrate retainer_deals',
    )
  }

  const income = JSON.parse(localStore.get('creatorexec-income-tracker') ?? '{}')
  const incomeEntries = Array.isArray(income)
    ? income
    : Object.entries(income).map(([monthKey, entry]) => ({
        id: crypto.randomUUID(),
        monthKey,
        source: 'TikTok Shop',
        note: null,
        ...entry,
      }))

  for (const entry of incomeEntries) {
    await assertOk(
      client.from('income_entries').upsert(
        {
          id: entry.id,
          user_id: userId,
          month_key: entry.monthKey ?? entry.month_key,
          source: entry.source ?? 'TikTok Shop',
          note: entry.note ?? null,
          gmv_total: entry.gmvTotal ?? entry.gmv_total ?? 0,
          estimated_commission: entry.estimatedCommission ?? entry.estimated_commission ?? 0,
          settled_commission: entry.settledCommission ?? entry.settled_commission ?? 0,
          brand_deals_income: entry.brandDealsIncome ?? entry.brand_deals_income ?? 0,
          bonuses_rewards: entry.bonusesRewards ?? entry.bonuses_rewards ?? 0,
        },
      ),
      'migrate income_entries',
    )
  }

  const scout = JSON.parse(localStore.get('creatorexec-product-scout') ?? '[]')
  if (scout.length > 0) {
    await assertOk(
      client.from('product_scout_list').upsert(
        scout.map((entry) => ({
          id: entry.id,
          user_id: userId,
          product_name: entry.productName,
          metrics: entry.metrics,
          created_at: entry.createdAt,
          updated_at: entry.updatedAt,
        })),
      ),
      'migrate product_scout_list',
    )
  }

  const onboarding = JSON.parse(localStore.get('creatorexec-onboarding') ?? 'null')
  if (onboarding?.completed) {
    await assertOk(
      client.from('onboarding_state').upsert({
        user_id: userId,
        completed: true,
        mode: onboarding.mode,
        videos_per_day: onboarding.videosPerDay,
        monthly_commission: onboarding.answers.monthlyCommission,
        filming_approach: onboarding.answers.filmingApproach,
        sprint_entry_seen: localStore.get('creatorexec-sprint-entry-seen') === 'true',
        welcome_seen: localStore.get('creatorexec-welcome-seen') === 'true',
      }),
      'migrate onboarding_state',
    )
  }

  localStore.set(migrationFlagKey(userId), 'true')
}

async function main() {
  const { url, anonKey, serviceRoleKey } = assertEnv()
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const freshUser = await createTestUser(admin, 'fresh')
  const migrateUser = await createTestUser(admin, 'migrate')

  const freshClient = await signIn(url, anonKey, freshUser.email, freshUser.password, freshUser.id)
  const migrateClient = await signIn(
    url,
    anonKey,
    migrateUser.email,
    migrateUser.password,
    migrateUser.id,
  )

  try {
    console.log('Phase 3 Supabase data verification')
    console.log('='.repeat(60))

    // 1) Fresh account — write directly via authenticated client
    console.log('\n[1/3] Fresh account read/write')
    await assertOk(
      freshClient.from('trial_progress').insert({
        user_id: freshUser.id,
        product_id: 'fresh-product-1',
        videos_filmed: 3,
        source: 'manual',
      }),
      'fresh trial_progress insert',
    )
    await assertOk(
      freshClient.from('onboarding_state').upsert({
        user_id: freshUser.id,
        completed: true,
        mode: 'beginner',
        videos_per_day: 5,
        monthly_commission: 'growing',
        filming_approach: 'rough_system',
        sprint_entry_seen: true,
      }),
      'fresh onboarding_state upsert',
    )

    const freshTrial = await assertOk(
      freshClient.from('trial_progress').select('*').eq('user_id', freshUser.id),
      'fresh trial_progress select',
    )
    if (freshTrial.length !== 1 || freshTrial[0].videos_filmed !== 3) {
      throw new Error('Fresh account trial_progress round-trip failed')
    }
    console.log('PASS: fresh account writes readable under RLS')

    // 2) Existing local data migration simulation
    console.log('\n[2/3] One-time localStorage migration simulation')
    const localStore = installLocalStoragePolyfill()
    localStore.set(
      'creatorexec-product-scout',
      JSON.stringify([sampleProductScoutEntry]),
    )
    localStore.set('creatorexec-brand-deals', JSON.stringify([sampleBrandDeal]))
    localStore.set(
      'creatorexec-trial-progress',
      JSON.stringify({ 'prod-abc': { videosFilmed: 4, source: 'manual' } }),
    )
    localStore.set(
      'creatorexec-income-tracker',
      JSON.stringify({
        '2026-07': {
          gmvTotal: 12000,
          estimatedCommission: 1800,
          settledCommission: 900,
          brandDealsIncome: 500,
          bonusesRewards: 100,
        },
      }),
    )
    localStore.set(
      'creatorexec-onboarding',
      JSON.stringify({
        completed: true,
        mode: 'advanced',
        videosPerDay: 8,
        answers: {
          monthlyCommission: 'established',
          videosPerDay: 8,
          filmingApproach: 'solid_system',
        },
      }),
    )
    localStore.set('creatorexec-sprint-entry-seen', 'true')

    await migrateLocalStorageToSupabase(migrateClient, migrateUser.id, localStore)
    if (localStore.get(migrationFlagKey(migrateUser.id)) !== 'true') {
      throw new Error('Migration flag was not set')
    }

    const migratedScout = await assertOk(
      migrateClient.from('product_scout_list').select('*').eq('user_id', migrateUser.id),
      'migrated product_scout_list select',
    )
    if (migratedScout.length !== 1 || migratedScout[0].product_name !== 'Vitamin C Serum') {
      throw new Error('Product Scout migration failed')
    }

    const migratedDeals = await assertOk(
      migrateClient.from('retainer_deals').select('*').eq('user_id', migrateUser.id),
      'migrated retainer_deals select',
    )
    if (migratedDeals.length !== 1 || migratedDeals[0].brand_name !== 'Glow Labs') {
      throw new Error('Brand deals migration failed')
    }

    // Re-run migration — must not duplicate
    await migrateLocalStorageToSupabase(migrateClient, migrateUser.id, localStore)
    const scoutAfterSecondRun = await assertOk(
      migrateClient.from('product_scout_list').select('id').eq('user_id', migrateUser.id),
      'product_scout_list count after second migration',
    )
    if (scoutAfterSecondRun.length !== 1) {
      throw new Error('Second migration duplicated Product Scout rows')
    }
    console.log('PASS: one-time migration uploads local data without duplicates')

    // 3) Cross-device read — new client session, same user
    console.log('\n[3/3] Cross-device read (new session, same user)')
    const secondSessionClient = await signIn(
      url,
      anonKey,
      migrateUser.email,
      migrateUser.password,
      migrateUser.id,
    )
    const crossRead = await assertOk(
      secondSessionClient.from('product_scout_list').select('product_name').eq('user_id', migrateUser.id),
      'cross-device product_scout_list select',
    )
    if (crossRead.length !== 1 || crossRead[0].product_name !== 'Vitamin C Serum') {
      throw new Error('Cross-device read failed')
    }
    console.log('PASS: same user sees migrated data from a new session')

    await dumpUserTables(admin, migrateUser.id, 'migrate user (proof)')
    await dumpUserTables(admin, freshUser.id, 'fresh user (proof)')

    console.log('\n' + '='.repeat(60))
    console.log('All Phase 3 data tests passed.')
  } finally {
    await admin.auth.admin.deleteUser(freshUser.id)
    await admin.auth.admin.deleteUser(migrateUser.id)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

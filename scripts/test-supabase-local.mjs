import pg from 'pg'
import { randomUUID } from 'node:crypto'

const { Client } = pg

const userA = randomUUID()
const userB = randomUUID()

async function withRole(client, role, jwtSub, fn) {
  await client.query('BEGIN')
  try {
    await client.query(`SET LOCAL ROLE ${role}`)
    if (jwtSub) {
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [jwtSub])
    }
    const result = await fn()
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

async function assertInsert(client, role, userId, sql, params, label) {
  await withRole(client, role, userId, async () => {
    await client.query(sql, params)
  })
  console.log(`PASS  ${label}`)
}

async function assertSelectEmpty(client, role, userId, sql, params, label) {
  const rows = await withRole(client, role, userId, async () => {
    const { rows } = await client.query(sql, params)
    return rows
  })
  if (rows.length > 0) {
    throw new Error(`${label}: expected 0 rows, got ${rows.length}`)
  }
  console.log(`PASS  ${label}`)
}

async function assertSelectOne(client, role, userId, sql, params, label) {
  const rows = await withRole(client, role, userId, async () => {
    const { rows } = await client.query(sql, params)
    return rows
  })
  if (rows.length !== 1) {
    throw new Error(`${label}: expected 1 row, got ${rows.length}`)
  }
  console.log(`PASS  ${label}`)
}

async function main() {
  const client = new Client({
    host: process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    database: 'creatorexec_supabase_test',
    user: 'creatorexec_test',
    password: 'creatorexec_test',
  })

  await client.connect()

  try {
    await client.query('INSERT INTO auth.users (id) VALUES ($1), ($2)', [userA, userB])

    const trialId = randomUUID()

  await assertInsert(
    client,
    'authenticated',
    userA,
    `INSERT INTO public.trial_progress (id, user_id, product_id, videos_filmed, source)
     VALUES ($1, $2, $3, $4, $5)`,
    [trialId, userA, 'test-product-123', 2, 'manual'],
    'insert trial_progress as authenticated user A',
  )

  await assertSelectOne(
    client,
    'authenticated',
    userA,
    'SELECT id FROM public.trial_progress WHERE id = $1',
    [trialId],
    'read own trial_progress as user A',
  )

  await assertSelectEmpty(
    client,
    'authenticated',
    userB,
    'SELECT id FROM public.trial_progress WHERE id = $1',
    [trialId],
    'user B cannot read user A trial_progress (RLS)',
  )

  const dealId = randomUUID()
  await assertInsert(
    client,
    'authenticated',
    userA,
    `INSERT INTO public.retainer_deals (id, user_id, brand_name, product, stage, is_retainer)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [dealId, userA, 'Test Brand', 'Sample SKU', 'negotiating', true],
    'insert retainer_deals as user A',
  )

  await assertSelectEmpty(
    client,
    'authenticated',
    userB,
    'SELECT id FROM public.retainer_deals WHERE id = $1',
    [dealId],
    'user B cannot read user A retainer_deals (RLS)',
  )

  await assertInsert(
    client,
    'authenticated',
    userA,
    `INSERT INTO public.income_entries (user_id, month_key, source, note, gmv_total, estimated_commission, settled_commission, brand_deals_income, bonuses_rewards)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [userA, '2026-07', 'TikTok Shop', null, 12000, 1800, 1500, 500, 100],
    'insert income_entries as user A',
  )

  await assertInsert(
    client,
    'authenticated',
    userA,
    `INSERT INTO public.product_scout_list (user_id, product_name, metrics, verdict, total_score)
     VALUES ($1, $2, $3::jsonb, $4, $5)`,
    [userA, 'Scout Widget', '{}', 'strong', 82],
    'insert product_scout_list as user A',
  )

  await assertInsert(
    client,
    'authenticated',
    userA,
    `INSERT INTO public.onboarding_state (user_id, completed, mode, videos_per_day, monthly_commission, filming_approach, welcome_seen, sprint_entry_seen)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [userA, true, 'beginner', 5, 'growing', 'rough_system', true, false],
    'insert onboarding_state as user A',
  )

  await assertInsert(
    client,
    'authenticated',
    userA,
    `INSERT INTO public.sprint_history (user_id, file_name, schedule_mode, videos_per_day, sprint_days, end_total_commission)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userA, 'commission-report.csv', 'full', 5, 7, 1500],
    'insert sprint_history as user A',
  )

  console.log(
    'Local Supabase foundation test passed: GRANTs allow authenticated inserts; RLS blocks cross-user reads.',
  )
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})

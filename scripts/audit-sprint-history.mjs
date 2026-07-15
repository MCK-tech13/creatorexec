/**
 * Audit real sprint_history depth for product-flag readiness.
 *
 * Requires .env with:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: node --env-file=.env scripts/audit-sprint-history.mjs
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error(
    'Missing credentials. Required: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY',
  )
  process.exit(1)
}

const DECLINE_THRESHOLD = 0.15
const STALLED_TIERS = new Set(['Test', 'Rising'])

function declined(previous, current) {
  if (!(previous > 0)) return false
  return (current - previous) / previous <= -DECLINE_THRESHOLD
}

function parseProducts(endSnapshot) {
  if (!endSnapshot || typeof endSnapshot !== 'object') return []
  return Array.isArray(endSnapshot.products) ? endSnapshot.products : []
}

function findByKey(products, key) {
  return products.find((product) => product.key === key)
}

function analyzeUser(rows) {
  // rows: newest-first
  const snapshots = rows.map((row) => parseProducts(row.end_snapshot))
  let potentialStalled = 0
  let potentialSlowing = 0

  // History-only stalled signal: same Test/Rising tier across the two
  // newest completed ends. Live UI also requires current products match.
  if (snapshots.length >= 2) {
    const [recent, prior] = snapshots
    const keys = new Set(recent.map((product) => product.key))
    for (const key of keys) {
      const a = findByKey(prior, key)
      const b = findByKey(recent, key)
      if (!a || !b) continue
      if (!STALLED_TIERS.has(a.tier) || !STALLED_TIERS.has(b.tier)) continue
      if (a.tier === b.tier) potentialStalled += 1
    }
  }

  // Four end points → three consecutive declines. Approximates Slowing when
  // the current sprint still mirrors the newest completed end snapshot.
  if (snapshots.length >= 4) {
    const window = [...snapshots.slice(0, 4)].reverse()
    const keys = new Set(window[window.length - 1].map((product) => product.key))
    for (const key of keys) {
      const points = window.map((products) => findByKey(products, key))
      if (points.some((product) => !product || product.tier !== 'Anchor')) continue
      const commissions = points.map((product) => Number(product.commission) || 0)
      let ok = true
      for (let i = 0; i < 3; i += 1) {
        if (!declined(commissions[i], commissions[i + 1])) {
          ok = false
          break
        }
      }
      if (ok) potentialSlowing += 1
    }
  }

  return { potentialStalled, potentialSlowing }
}

async function main() {
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: rows, error } = await admin
    .from('sprint_history')
    .select('id, user_id, ended_at, end_snapshot')
    .order('ended_at', { ascending: false })

  if (error) throw error

  const byUser = new Map()
  for (const row of rows ?? []) {
    const list = byUser.get(row.user_id) ?? []
    list.push(row)
    byUser.set(row.user_id, list)
  }

  const depthBuckets = {
    0: 0,
    1: 0,
    2: 0,
    '3+': 0,
  }

  const { data: onboardingRows, error: onboardingError } = await admin
    .from('onboarding_state')
    .select('user_id, sprint_previous_snapshot')

  if (onboardingError) {
    console.warn('Could not load onboarding_state:', onboardingError.message)
  }

  const usersSeen = new Set([
    ...byUser.keys(),
    ...(onboardingRows ?? []).map((row) => row.user_id),
  ])

  for (const userId of usersSeen) {
    const count = byUser.get(userId)?.length ?? 0
    if (count <= 0) depthBuckets[0] += 1
    else if (count === 1) depthBuckets[1] += 1
    else if (count === 2) depthBuckets[2] += 1
    else depthBuckets['3+'] += 1
  }

  console.log('=== sprint_history inventory ===')
  console.log(`Total sprint_history rows: ${rows?.length ?? 0}`)
  console.log(`Users with any onboarding/history footprint: ${usersSeen.size}`)
  console.log('Users by completed-sprint depth:')
  console.log(`  0 sprints: ${depthBuckets[0]}`)
  console.log(`  1 sprint:  ${depthBuckets[1]}`)
  console.log(`  2 sprints: ${depthBuckets[2]}  ← can see Stalled (if tiers hold into current sprint)`)
  console.log(`  3+ sprints: ${depthBuckets['3+']} ← enough depth for Slowing once current declines also qualify`)

  console.log('\n=== per-user detail (non-zero history only) ===')
  const sortedUsers = [...byUser.entries()].sort((a, b) => b[1].length - a[1].length)
  if (sortedUsers.length === 0) {
    console.log('(no sprint_history rows yet)')
  }
  for (const [userId, userRows] of sortedUsers) {
    const analysis = analyzeUser(userRows)
    const newest = userRows[0]?.ended_at ?? 'n/a'
    const oldest = userRows[userRows.length - 1]?.ended_at ?? 'n/a'
    console.log(
      [
        `user=${userId.slice(0, 8)}…`,
        `sprints=${userRows.length}`,
        `range=${oldest} → ${newest}`,
        `history-only potential stalled pairs=${analysis.potentialStalled}`,
        `history-only potential slowing=${analysis.potentialSlowing}`,
      ].join(' | '),
    )
  }

  const readyStalled = sortedUsers.filter(([, userRows]) => userRows.length >= 2).length
  const readySlowing = sortedUsers.filter(([, userRows]) => userRows.length >= 3).length
  console.log('\n=== flag readiness (history depth only) ===')
  console.log(`Users with ≥2 completed sprints (Stalled eligible): ${readyStalled}`)
  console.log(`Users with ≥3 completed sprints (Slowing eligible): ${readySlowing}`)
  console.log(
    '\nNote: "potential" counts compare end_snapshots only. Live badges also require the product still present at current tiers/commissions in the active sprint.',
  )
  console.log(
    'Also: Slowing needs 3 consecutive declines relative to the CURRENT live commission, so users with exactly 3 history rows need one more active-sprint decline to light the badge.',
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

/**
 * Unit checks for client version guard helpers (SHA-keyed reload loop).
 * Usage: npx tsx scripts/verify-client-version-guard.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const guardSrc = readFileSync(
  join(process.cwd(), 'src/lib/version/clientVersionGuard.ts'),
  'utf8',
)

assert.match(guardSrc, /RELOADED_FOR_SHA_KEY/)
assert.match(guardSrc, /ce-reloaded-for-version-sha/)
assert.match(guardSrc, /readReloadedForSha\(\) === liveSha/)
assert.match(guardSrc, /POLL_INTERVAL_MS = 90_000/)
assert.match(guardSrc, /beforeReload/)
assert.match(guardSrc, /hasDirtyClientForms/)
assert.match(guardSrc, /registerBeforeClientReload/)
assert.match(guardSrc, /runBeforeReloadHandlers/)

const scorerSrc = readFileSync(join(process.cwd(), 'src/lib/productScout/scorer.ts'), 'utf8')
assert.match(scorerSrc, /export const SCORING_LOGIC_VERSION = 2/)

const mapperSrc = readFileSync(join(process.cwd(), 'src/lib/supabase/mappers.ts'), 'utf8')
assert.match(mapperSrc, /scoring_logic_version: scored \? SCORING_LOGIC_VERSION : null/)

const vercel = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'))
const versionHeader = vercel.headers?.find((h: { source: string }) => h.source === '/version.json')
assert.ok(versionHeader, 'version.json cache header missing')
assert.equal(
  versionHeader.headers.find((h: { key: string }) => h.key === 'Cache-Control')?.value,
  'no-store, must-revalidate',
)
assert.match(vercel.rewrites[0].source, /version/)

console.log('Client version guard checks passed.')

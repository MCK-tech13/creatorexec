/**
 * Writes dist/version.json with the deploy commit SHA.
 * Used by the client version guard to detect stale bundles after Production deploys.
 *
 * Usage: node scripts/write-version-json.mjs
 * (runs after `vite build` via npm run build)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const distDir = join(root, 'dist')

const sha =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VITE_VERCEL_GIT_COMMIT_SHA ||
  process.env.CF_PAGES_COMMIT_SHA ||
  'dev'

mkdirSync(distDir, { recursive: true })
const payload = {
  sha,
  builtAt: new Date().toISOString(),
}
writeFileSync(join(distDir, 'version.json'), `${JSON.stringify(payload, null, 2)}\n`)
console.log(`Wrote dist/version.json sha=${sha}`)

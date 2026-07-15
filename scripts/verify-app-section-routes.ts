/**
 * Verifies /app/:section path helpers and reload landing resolution.
 * Usage: npx tsx scripts/verify-app-section-routes.ts
 */
import assert from 'node:assert/strict'
import {
  appPathForSection,
  parseAppSectionPath,
} from '../src/lib/navigation/appSections.ts'
import type { MainSection } from '../src/types/index.ts'

const SECTIONS: MainSection[] = ['home', 'sprint', 'retainers', 'income', 'product-scout']

for (const section of SECTIONS) {
  const path = appPathForSection(section)
  assert.equal(path, `/app/${section === 'product-scout' ? 'product-scout' : section}`)
  assert.equal(parseAppSectionPath(path), section)
  assert.equal(parseAppSectionPath(`${path}/`), section, 'trailing slash normalized')
}

assert.equal(parseAppSectionPath('/app'), null)
assert.equal(parseAppSectionPath('/app/'), null)
assert.equal(parseAppSectionPath('/app/unknown'), 'invalid')
assert.equal(parseAppSectionPath('/login'), 'invalid')

/** Mirrors CreatorExecApp initial section resolution. */
function resolveInitialSection(
  pathname: string,
  restoredStage: string | null,
): MainSection {
  const fromUrl = parseAppSectionPath(pathname)
  if (fromUrl && fromUrl !== 'invalid') return fromUrl
  return restoredStage === 'schedule' ? 'sprint' : 'home'
}

/** Mirrors bare-/app redirect target. */
function resolveBareAppRedirect(restoredStage: string | null): MainSection {
  return restoredStage === 'schedule' ? 'sprint' : 'home'
}

// Reload tests: each section URL wins over sprint-restore fallback
for (const section of SECTIONS) {
  const landed = resolveInitialSection(appPathForSection(section), 'schedule')
  assert.equal(
    landed,
    section,
    `reload on ${appPathForSection(section)} must land on ${section}, not sprint fallback`,
  )
}

// Bare /app uses sprint-restore fallback only
assert.equal(resolveBareAppRedirect(null), 'home')
assert.equal(resolveBareAppRedirect('schedule'), 'sprint')
assert.equal(resolveInitialSection('/app', 'schedule'), 'sprint')
assert.equal(resolveInitialSection('/app', 'upload'), 'home')
assert.equal(resolveInitialSection('/app/product-scout', 'schedule'), 'product-scout')

// Simulates navigate after bare /app
const bareTarget = resolveBareAppRedirect('upload')
assert.equal(appPathForSection(bareTarget), '/app/home')

console.log('verify-app-section-routes: all section reload landing checks passed')
for (const section of SECTIONS) {
  console.log(`  ✓ ${appPathForSection(section)} → ${section}`)
}
console.log('  ✓ /app (no section) → home, or sprint when restored schedule')

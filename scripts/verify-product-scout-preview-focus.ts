/**
 * Verify Product Scout draft survive focus-reload semantics.
 * Run: npx tsx scripts/verify-product-scout-preview-focus.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  clearProductScoutDraft,
  saveProductScoutDraft,
  takeProductScoutDraft,
} from '../src/lib/version/productScoutDraft'
import type { ProductScoutMetrics } from '../src/types/productScout'

const metrics: ProductScoutMetrics = {
  orders: { value: '2.5K', delta: '+2.1K' },
  ctr: { value: '3.2', delta: '-0.3' },
  creators: { value: '500', delta: '+67' },
  atcUsers: { value: '20K', delta: '+13.5K' },
}

// Minimal sessionStorage polyfill for Node
const store = new Map<string, string>()
;(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => {
    store.set(k, String(v))
  },
  removeItem: (k) => {
    store.delete(k)
  },
  clear: () => store.clear(),
  key: () => null,
  get length() {
    return store.size
  },
}

clearProductScoutDraft()

saveProductScoutDraft({
  productName: 'Hadley Focus Test',
  metrics,
  mode: 'new',
})
const first = takeProductScoutDraft()
assert.ok(first)
assert.equal(first.productName, 'Hadley Focus Test')

// StrictMode second mount — same draft identity epoch
const second = takeProductScoutDraft()
assert.equal(second?.productName, 'Hadley Focus Test')

// Newer autosave after "reload" must be consumable again
saveProductScoutDraft({
  productName: 'Hadley After Reload',
  metrics,
  mode: 'new',
})
const third = takeProductScoutDraft()
assert.equal(third?.productName, 'Hadley After Reload')

const formSrc = readFileSync(
  join(process.cwd(), 'src/components/productScout/ProductScoutForm.tsx'),
  'utf8',
)
assert.match(formSrc, /hasUnsavedWork = isDirty \|\| ocrReading/)
assert.match(formSrc, /registerBeforeClientReload/)
assert.match(formSrc, /visibilitychange/)
assert.match(formSrc, /pagehide/)

const guardSrc = readFileSync(
  join(process.cwd(), 'src/lib/version/clientVersionGuard.ts'),
  'utf8',
)
assert.match(guardSrc, /registerBeforeClientReload/)
assert.match(guardSrc, /runBeforeReloadHandlers/)

console.log('verify-product-scout-preview-focus: PASS')

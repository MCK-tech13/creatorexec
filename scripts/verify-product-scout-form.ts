import { EMPTY_PRODUCT_SCOUT_METRICS } from '../src/lib/productScout/formDefaults'
import { hasProductScoutData, scoreProductScout } from '../src/lib/productScout/scorer'
import type { ProductScoutMetrics } from '../src/types/productScout'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function canSubmitForm(metrics: ProductScoutMetrics): boolean {
  if (!hasProductScoutData(metrics)) return false
  return scoreProductScout(metrics) !== null
}

const metricsOnly: ProductScoutMetrics = {
  ...EMPTY_PRODUCT_SCOUT_METRICS,
  orders: { value: '24.1K', delta: '+3.6K' },
  ctr: { value: '3.5', delta: '-0.5' },
  creators: { value: '8.8K', delta: '+1.1K' },
  atcUsers: { value: '74.1K', delta: '+13.2K' },
}

assert(canSubmitForm(metricsOnly), 'Valid metrics should enable submit (name validated on click)')
assert(scoreProductScout(metricsOnly)?.verdict != null, 'Score result should include verdict')

const empty = EMPTY_PRODUCT_SCOUT_METRICS
assert(!canSubmitForm(empty), 'Empty metrics should not enable submit')

console.log('Product Scout form submit checks passed.')

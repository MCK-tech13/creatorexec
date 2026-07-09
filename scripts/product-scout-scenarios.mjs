/**
 * Product Scout scoring scenario runner.
 * Usage: node scripts/product-scout-scenarios.mjs
 */
import { scoreProductScout } from '../src/lib/productScout/scorer.ts'

/** @type {Array<{ name: string, metrics: import('../src/types/productScout.ts').ProductScoutMetrics }>} */
const scenarios = [
  {
    name: '1. Saturated loser — declining orders, creators climbing, weak CTR, poor conversion',
    metrics: {
      orders: { value: '8.2K', delta: '-12%' },
      ctr: { value: '1.8%', delta: '-0.4%' },
      creators: { value: '3.4K', delta: '+18%' },
      atcUsers: { value: '42K', delta: '+5%' },
    },
  },
  {
    name: '2. Crowded but converting — high creators, strong conversion, flat CTR',
    metrics: {
      orders: { value: '22K', delta: '+6%' },
      ctr: { value: '3.1%', delta: '0%' },
      creators: { value: '2.8K', delta: '+3%' },
      atcUsers: { value: '95K', delta: '+4%' },
    },
  },
  {
    name: '3. Early gem — low creators, rising orders, strong CTR, good conversion',
    metrics: {
      orders: { value: '1.2K', delta: '+28%' },
      ctr: { value: '5.2%', delta: '+0.6%' },
      creators: { value: '85', delta: '+12%' },
      atcUsers: { value: '4.5K', delta: '+20%' },
    },
  },
  {
    name: '4. Content fatigue — 2K+ creators, declining CTR, orders flat',
    metrics: {
      orders: { value: '15K', delta: '-2%' },
      ctr: { value: '2.4%', delta: '-0.8%' },
      creators: { value: '2.1K', delta: '+9%' },
      atcUsers: { value: '68K', delta: '-1%' },
    },
  },
  {
    name: '5. Hype no conversion — rising orders/CTR but terrible ATC-to-order',
    metrics: {
      orders: { value: '9K', delta: '+15%' },
      ctr: { value: '4.5%', delta: '+0.3%' },
      creators: { value: '1.1K', delta: '+22%' },
      atcUsers: { value: '180K', delta: '+30%' },
    },
  },
  {
    name: '6. Moderate lane — mid creators, steady metrics, average conversion',
    metrics: {
      orders: { value: '6.5K', delta: '+3%' },
      ctr: { value: '3.0%', delta: '+0.1%' },
      creators: { value: '920', delta: '+4%' },
      atcUsers: { value: '38K', delta: '+2%' },
    },
  },
  {
    name: '7. Dead product — falling orders, high creators, weak everything',
    metrics: {
      orders: { value: '2.1K', delta: '-25%' },
      ctr: { value: '1.2%', delta: '-0.5%' },
      creators: { value: '4.5K', delta: '+8%' },
      atcUsers: { value: '55K', delta: '-10%' },
    },
  },
  {
    name: '8. Low competition breakout — sub-200 creators, all green',
    metrics: {
      orders: { value: '3.8K', delta: '+35%' },
      ctr: { value: '6.1%', delta: '+1.2%' },
      creators: { value: '140', delta: '+5%' },
      atcUsers: { value: '12K', delta: '+25%' },
    },
  },
  {
    name: '9. Crowded weak conversion — 3K creators, moderate CTR, <8% conversion',
    metrics: {
      orders: { value: '11K', delta: '+2%' },
      ctr: { value: '2.9%', delta: '-0.1%' },
      creators: { value: '3.2K', delta: '+6%' },
      atcUsers: { value: '200K', delta: '+8%' },
    },
  },
  {
    name: '10. Borderline popular — 2.5K creators, rising orders, average conversion',
    metrics: {
      orders: { value: '18K', delta: '+8%' },
      ctr: { value: '3.4%', delta: '+0.2%' },
      creators: { value: '2.5K', delta: '+5%' },
      atcUsers: { value: '110K', delta: '+6%' },
    },
  },
  {
    name: '11. Popular product, no trend deltas entered (common input)',
    metrics: {
      orders: { value: '18K', delta: '' },
      ctr: { value: '3.4%', delta: '' },
      creators: { value: '2.5K', delta: '' },
      atcUsers: { value: '110K', delta: '' },
    },
  },
  {
    name: '12. Weak crowded product, no trend deltas entered',
    metrics: {
      orders: { value: '2.1K', delta: '' },
      ctr: { value: '1.2%', delta: '' },
      creators: { value: '4.5K', delta: '' },
      atcUsers: { value: '55K', delta: '' },
    },
  },
]

function formatSignals(signals) {
  return signals.map((s) => `${s.label}: ${s.points >= 0 ? '+' : ''}${s.points}`).join(' | ')
}

console.log('Product Scout scenario audit\n' + '='.repeat(72))

const verdictCounts = { strong: 0, test: 0, pass: 0 }
const funnelCounts = {}

for (const scenario of scenarios) {
  const result = scoreProductScout(scenario.metrics)
  if (!result) {
    console.log(`\n${scenario.name}\n  ERROR: no score result`)
    continue
  }

  verdictCounts[result.verdict]++
  funnelCounts[result.funnel.headline] = (funnelCounts[result.funnel.headline] ?? 0) + 1

  const conv =
    result.atcConversionRate != null ? `${result.atcConversionRate.toFixed(1)}%` : 'n/a'

  console.log(`\n${scenario.name}`)
  console.log(`  Score: ${result.totalScore} → ${result.verdictLabel} (${result.verdict})`)
  console.log(`  ATC→order: ${conv}`)
  console.log(`  Signals: ${formatSignals(result.signals)}`)
  console.log(`  Funnel: ${result.funnel.headline}`)
}

console.log('\n' + '='.repeat(72))
console.log('Verdict distribution:', verdictCounts)
console.log('Funnel distribution:', funnelCounts)

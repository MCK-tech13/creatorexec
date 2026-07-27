/**
 * Regression: commission parser must use Est. columns, never settled/actual.
 * Pending/unsettled orders have $0 in Standard / Shop Ads / Total final earned
 * while Est. columns hold the real commission used for tiering.
 *
 * Usage: npx tsx scripts/verify-est-commission-columns.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapColumns, isSettledCommissionHeader, normalizeHeader } from '../src/lib/csv/columnMapper'
import { parseCommissionCsv, isParseError } from '../src/lib/csv/parser'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function money(n: number) {
  return `$${n.toFixed(2)}`
}

console.log('='.repeat(64))
console.log('Est. commission column mapping verification')
console.log('='.repeat(64))

// --- Header mapping: dual Est. + settled columns ---
{
  const headers = [
    'Product name',
    'Product ID',
    'Items sold',
    'GMV',
    'Standard commission',
    'Shop Ads commission',
    'Total final earned amount',
    'Est. standard commission',
    'Est. Shop Ads commission',
    'Payment status',
  ]
  const mapping = mapColumns(headers)
  assert.ok(mapping, 'mapping should succeed with Est. + settled columns present')
  assert.equal(headers[mapping!.estStandardCommission], 'Est. standard commission')
  assert.equal(headers[mapping!.estShopAdsCommission], 'Est. Shop Ads commission')
  console.log('\n1) Dual-column header map → Est. standard + Est. Shop Ads ✓')
}

// --- "Estimated …" wording (not "Est.") must still bind Est., not settled ---
{
  const headers = [
    'Product name',
    'Product ID',
    'Items sold',
    'GMV',
    'Standard commission',
    'Shop Ads commission',
    'Estimated standard commission',
    'Estimated Shop Ads commission',
  ]
  const mapping = mapColumns(headers)
  assert.ok(mapping, 'Estimated* headers must map')
  assert.equal(headers[mapping!.estStandardCommission], 'Estimated standard commission')
  assert.equal(headers[mapping!.estShopAdsCommission], 'Estimated Shop Ads commission')
  console.log('2) "Estimated …" headers map to estimated columns ✓')
}

// --- Est.Standard (no space after period) ---
{
  const headers = [
    'Product Name',
    'Product ID',
    'Items Sold',
    'GMV',
    'Standard Commission',
    'Shop Ads Commission',
    'Est.Standard Commission',
    'Est.Shop Ads Commission',
  ]
  const mapping = mapColumns(headers)
  assert.ok(mapping, 'Est.Standard (no space) must map')
  assert.equal(headers[mapping!.estStandardCommission], 'Est.Standard Commission')
  assert.equal(headers[mapping!.estShopAdsCommission], 'Est.Shop Ads Commission')
  console.log('3) Est.Standard / Est.Shop Ads (no space) map correctly ✓')
}

// --- Settled-only export must NOT silently use settled as Est. ---
{
  const headers = [
    'Product name',
    'Product ID',
    'Items sold',
    'GMV',
    'Standard commission',
    'Shop Ads commission',
    'Total final earned amount',
  ]
  const mapping = mapColumns(headers)
  assert.equal(mapping, null, 'settled-only headers must fail closed (no Est. columns)')
  console.log('4) Settled-only headers fail closed (no false Est. bind) ✓')
}

// --- Settled detector ---
{
  assert.equal(isSettledCommissionHeader(normalizeHeader('Standard commission')), true)
  assert.equal(isSettledCommissionHeader(normalizeHeader('Shop Ads commission')), true)
  assert.equal(isSettledCommissionHeader(normalizeHeader('Total final earned amount')), true)
  assert.equal(isSettledCommissionHeader(normalizeHeader('Est. standard commission')), false)
  assert.equal(isSettledCommissionHeader(normalizeHeader('Estimated Shop Ads commission')), false)
  console.log('5) Settled vs estimated header detector ✓')
}

// --- Real pending-settlement fixture: per-product totals ---
{
  const csv = readFileSync(path.join(root, 'src/data/pending-settlement-commission.csv'), 'utf8')
  const result = parseCommissionCsv(csv)
  assert.ok(!isParseError(result), isParseError(result) ? result.message : 'parse ok')

  const byName = new Map(result.products.map((p) => [p.productName, p]))

  // Pending Serum Glow: Est 6+1.50 + 3+0.75 = 11.25 (settled cols are 0/blank)
  const serum = byName.get('Pending Serum Glow')
  assert.ok(serum, 'Pending Serum Glow present')
  assert.equal(Number(serum!.commission.toFixed(2)), 11.25)
  console.log(
    `\n6) Pending Serum Glow → commission=${money(serum!.commission)} (Est. sum, not $0)`,
  )

  // Pending Lip Oil: Est 9+0 = 9 (settled all 0)
  const lip = byName.get('Pending Lip Oil')
  assert.ok(lip, 'Pending Lip Oil present')
  assert.equal(Number(lip!.commission.toFixed(2)), 9)
  console.log(`   Pending Lip Oil → commission=${money(lip!.commission)}`)

  // Settled Brow Tint: Est matches settled 2.25+0.50 = 2.75
  const brow = byName.get('Settled Brow Tint')
  assert.ok(brow, 'Settled Brow Tint present')
  assert.equal(Number(brow!.commission.toFixed(2)), 2.75)
  console.log(`   Settled Brow Tint → commission=${money(brow!.commission)}`)

  // Estimated-Name Variant row still aggregates
  const variant = byName.get('Estimated-Name Variant')
  assert.ok(variant, 'Estimated-Name Variant present')
  assert.equal(Number(variant!.commission.toFixed(2)), 5.5)
  console.log(`   Estimated-Name Variant → commission=${money(variant!.commission)}`)

  const total = result.products.reduce((s, p) => s + p.commission, 0)
  assert.equal(Number(total.toFixed(2)), 28.5)
  console.log(`   TOTAL commission across products: ${money(total)}`)
  console.log('   ✓ all match Est. column sums (not settled $0)')
}

// --- Regression: old buggy alias must not return ---
{
  const src = readFileSync(path.join(root, 'src/lib/csv/columnMapper.ts'), 'utf8')
  assert.ok(
    !src.includes("'shop ads commission'"),
    'bare settled alias shop ads commission must not remain in COLUMN_ALIASES',
  )
  console.log('\n7) Bare settled Shop Ads alias removed from mapper ✓')
}

console.log('\nverify-est-commission-columns: PASS')

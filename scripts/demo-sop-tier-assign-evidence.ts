/**
 * Evidence dump for SOP tier assignment (PR 2) — real sample CSV products,
 * Band A/B/Retired qualification math, and full/momentum no-leak check vs main.
 *
 * Usage: npx tsx scripts/demo-sop-tier-assign-evidence.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCommissionCsv, isParseError } from '../src/lib/csv/parser'
import {
  assignSopWinnerBand,
  meetsSopPerItemCondition,
  hasSopHighTicketOverride,
  tierProductsSop,
} from '../src/lib/analysis/sopTierAssign'
import { computeSopScaling } from '../src/lib/analysis/sopTierEngine'
import { retierProductsForMode } from '../src/lib/analysis/momentumMode'
import type { MergedProduct } from '../src/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const csvPath = path.join(root, 'src/data/sample-commission.csv')

function money(n: number) {
  return `$${n.toFixed(2)}`
}

function cpi(commission: number, itemsSold: number) {
  return itemsSold > 0 ? commission / itemsSold : 0
}

function row(p: {
  productName: string
  commission: number
  gmv: number
  itemsSold: number
  videosFilmed?: number
  sopTier?: string
  tier?: string
}) {
  const per = cpi(p.commission, p.itemsSold)
  return {
    product: p.productName.slice(0, 36),
    commission: money(p.commission),
    gmv: money(p.gmv),
    itemsSold: p.itemsSold,
    cpi: money(per),
    videos: p.videosFilmed ?? 0,
    sopTier: p.sopTier ?? '—',
    legacyTier: p.tier ?? '—',
  }
}

console.log('='.repeat(72))
console.log('SOP PR2 EVIDENCE — sample-commission.csv (repo golden fixture)')
console.log('='.repeat(72))

const csvText = readFileSync(csvPath, 'utf8')
const parsed = parseCommissionCsv(csvText)
if (isParseError(parsed)) {
  console.error(parsed.message)
  process.exit(1)
}

const ranked = [...parsed.products].sort((a, b) => b.commission - a.commission)
console.log(`\nParsed ${ranked.length} aggregated products from ${path.relative(root, csvPath)}\n`)
console.log('RAW AGGREGATES (all products, commission desc):')
console.table(
  ranked.map((p) => ({
    product: p.productName.slice(0, 36),
    commission: money(p.commission),
    gmv: money(p.gmv),
    itemsSold: p.itemsSold,
    cpi: money(cpi(p.commission, p.itemsSold)),
  })),
)

// --- 1) SOP assignment on real products (30×3) ---
const scaling30 = computeSopScaling({ dailyVolume: 30, sprintDays: 3 })
console.log('\n--- 1) SOP mode assignment @ 30 videos/day × 3-day sprint ---')
console.log(
  `Top/Mid budgets: Anchor ${scaling30.products.anchorProductCount} / Rotator ${scaling30.products.rotatorProductCount} / Mid ${scaling30.products.midProductCount}`,
)
console.log(
  `Band thresholds: A ${money(scaling30.bands.sprintBandAThreshold)} / B ${money(scaling30.bands.sprintBandBThreshold)} | CPI min $2 | high-ticket $10/item`,
)

const sopInputs = ranked.map((p, i) => ({
  id: p.id,
  productName: p.productName,
  productId: p.productId,
  gmv: p.gmv,
  commission: p.commission,
  itemsSold: p.itemsSold,
  orderCount: p.orderCount,
  videosFilmed: 6, // full-test complete so Band logic can apply outside Top/Mid
  inRotation: true,
  isManual: false,
}))

const { products: sopTiered, meta } = tierProductsSop(sopInputs, {
  dailyVolume: 30,
  sprintDays: 3,
})

console.log(
  `\nNote: Mid budget is 15 and CSV only has ${ranked.length} products, so at 30×3 every real row lands in Top/Mid (no Band seats left). Showing first 5:`,
)
console.table(
  sopTiered.slice(0, 5).map((p) => row(p)),
)
console.log(
  `meta: anchors=${meta.anchorCount} rotators=${meta.rotatorCount} mid=${meta.midCount} tieExpanded=${meta.anchorTieExpanded}`,
)

// --- 2) Force Band seats: pad Top/Mid with fillers, keep 3 real CSV products outside ---
console.log('\n--- 2) Band A / Band B / Retired on REAL CSV products ---')
console.log(
  'Pad 25 synthetic higher earners so these three fall outside Top/Mid, then apply Band qualification @ 30×3 ($15 / $5).',
)

const bandCandidates = [
  ranked.find((p) => p.productName.includes('Wireless Earbuds'))!, // $24.40 — Band A
  ranked.find((p) => p.productName.includes('LED Desk Lamp'))!, // $14.11 — Band B
  ranked.find((p) => p.productName.includes('Posture Corrector'))!, // $9.60 CPI $1.60 — Retired
]

console.log('\nQualification math (before assignment):')
for (const p of bandCandidates) {
  const per = cpi(p.commission, p.itemsSold)
  const thresholds = {
    sprintBandAThreshold: scaling30.bands.sprintBandAThreshold,
    sprintBandBThreshold: scaling30.bands.sprintBandBThreshold,
  }
  const band = assignSopWinnerBand(
    { commission: p.commission, itemsSold: p.itemsSold, videosFilmed: 6 },
    thresholds,
  )
  const perOk = meetsSopPerItemCondition(p.commission, p.itemsSold)
  const highTicket = hasSopHighTicketOverride(p.commission, p.itemsSold)
  console.log(
    [
      `  ${p.productName}`,
      `    commission=${money(p.commission)}  gmv=${money(p.gmv)}  itemsSold=${p.itemsSold}  cpi=${money(per)}`,
      `    videosFilmed=6 (full test complete)`,
      `    checks: commission>=BandA($${scaling30.bands.sprintBandAThreshold})? ${p.commission >= scaling30.bands.sprintBandAThreshold}`,
      `            commission>=BandB($${scaling30.bands.sprintBandBThreshold})? ${p.commission >= scaling30.bands.sprintBandBThreshold}`,
      `            commission<BandA? ${p.commission < scaling30.bands.sprintBandAThreshold}`,
      `            perItemOk (>=$2 or high-ticket)? ${perOk}  highTicket(>=$10/item)? ${highTicket}`,
      `    => assignSopWinnerBand = ${band}`,
    ].join('\n'),
  )
}

const fillers = Array.from({ length: 25 }, (_, i) => ({
  id: `filler-${i}`,
  productName: `Filler Top ${String(i).padStart(2, '0')}`,
  productId: `filler-${i}`,
  gmv: 10000 - i,
  commission: 500 - i,
  itemsSold: 50,
  orderCount: 10,
  videosFilmed: 6,
  inRotation: true,
  isManual: false,
}))

const bandPool = [
  ...fillers,
  ...bandCandidates.map((p) => ({
    id: p.id,
    productName: p.productName,
    productId: p.productId,
    gmv: p.gmv,
    commission: p.commission,
    itemsSold: p.itemsSold,
    orderCount: p.orderCount,
    videosFilmed: 6,
    inRotation: true,
    isManual: false,
  })),
]

const { products: bandTiered } = tierProductsSop(bandPool, {
  dailyVolume: 30,
  sprintDays: 3,
})

const focus = bandTiered.filter((p) =>
  bandCandidates.some((c) => c.id === p.id),
)
console.log('\nAssigned tiers for the three real products (outside Top/Mid):')
console.table(focus.map((p) => row(p)))

// Extra: high-ticket override using Mini Projector numbers from CSV (CPI $6.75, total $6.75)
const projector = ranked.find((p) => p.productName.includes('Mini Projector'))!
console.log('\nHigh-ticket / Band B edge on Mini Projector HD (real CSV row):')
{
  const per = cpi(projector.commission, projector.itemsSold)
  const band = assignSopWinnerBand(
    {
      commission: projector.commission,
      itemsSold: projector.itemsSold,
      videosFilmed: 6,
    },
    {
      sprintBandAThreshold: scaling30.bands.sprintBandAThreshold,
      sprintBandBThreshold: scaling30.bands.sprintBandBThreshold,
    },
  )
  console.log(
    `  ${projector.productName}: commission=${money(projector.commission)} items=${projector.itemsSold} cpi=${money(per)} => ${band}`,
  )
  console.log(
    `  (total in Band B window AND cpi>=$2 → BandB; not relying on $10 high-ticket override here)`,
  )
}

// High-ticket override: total below Band B threshold, but CPI >= $10
console.log('\nSynthetic high-ticket override (raised Band B so override is visible):')
{
  const thresholds = { sprintBandAThreshold: 50, sprintBandBThreshold: 20 }
  const commission = 12
  const itemsSold = 1
  const band = assignSopWinnerBand(
    { commission, itemsSold, videosFilmed: 6 },
    thresholds,
  )
  console.log(
    `  thresholds A=$50 B=$20; commission=${money(commission)} items=${itemsSold} cpi=${money(cpi(commission, itemsSold))} highTicket=${hasSopHighTicketOverride(commission, itemsSold)} => ${band}`,
  )
  console.log('  (total $12 < Band B $20, but high-ticket override forces BandB)')

  const noOverride = assignSopWinnerBand(
    { commission: 12, itemsSold: 2, videosFilmed: 6 }, // cpi=$6 — not high-ticket, below Band B
    thresholds,
  )
  console.log(
    `  control: commission=$12.00 items=2 cpi=$6.00 highTicket=${hasSopHighTicketOverride(12, 2)} => ${noOverride}`,
  )
}

// --- 3) No-leak: full / momentum identical to main ---
console.log('\n--- 3) No-leak check: full & momentum vs origin/main ---')

const modeInputs: MergedProduct[] = ranked.map((p) => ({
  id: p.id,
  productName: p.productName,
  productId: p.productId,
  gmv: p.gmv,
  commission: p.commission,
  itemsSold: p.itemsSold,
  orderCount: p.orderCount,
  videosFilmed: 0,
  score: 0,
  tier: 'Test',
  rankInTier: 0,
  inRotation: true,
  isManual: false,
}))

function fingerprint(
  products: MergedProduct[],
  mode: string,
): Array<{ id: string; tier: string; rankInTier: number; sopTier: string | null }> {
  return [...products]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => ({
      id: p.id,
      tier: p.tier,
      rankInTier: p.rankInTier,
      sopTier: p.sopTier ?? null,
    }))
}

const fullNow = retierProductsForMode(modeInputs, 'full')
const momNow = retierProductsForMode(modeInputs, 'momentum')
const sopNow = retierProductsForMode(modeInputs, 'sop', {
  dailyVolume: 30,
  sprintDays: 3,
})

console.log('\nCurrent branch — same 15 CSV products:')
console.log('FULL mode (first 5):')
console.table(
  [...fullNow]
    .sort((a, b) => b.commission - a.commission)
    .slice(0, 5)
    .map((p) => ({
      product: p.productName.slice(0, 36),
      commission: money(p.commission),
      tier: p.tier,
      sopTier: p.sopTier ?? null,
    })),
)
console.log('MOMENTUM mode (first 5):')
console.table(
  [...momNow]
    .sort((a, b) => b.commission - a.commission)
    .slice(0, 5)
    .map((p) => ({
      product: p.productName.slice(0, 36),
      commission: money(p.commission),
      itemsSold: p.itemsSold,
      tier: p.tier,
      sopTier: p.sopTier ?? null,
    })),
)
console.log('SOP mode (first 5) — for contrast:')
console.table(
  [...sopNow]
    .sort((a, b) => b.commission - a.commission)
    .slice(0, 5)
    .map((p) => ({
      product: p.productName.slice(0, 36),
      commission: money(p.commission),
      tier: p.tier,
      sopTier: p.sopTier ?? null,
    })),
)

// Compare against origin/main via worktree (reuse this repo's node_modules)
const worktree = '/tmp/ce-main-sop-evidence'
try {
  execFileSync('rm', ['-rf', worktree], { stdio: 'ignore' })
} catch {
  /* ignore */
}
execFileSync(
  'git',
  ['worktree', 'add', '--detach', worktree, 'origin/main'],
  { cwd: root, stdio: 'pipe' },
)
execFileSync('ln', ['-sfn', path.join(root, 'node_modules'), path.join(worktree, 'node_modules')])

const compareScriptPath = path.join(worktree, 'scripts/_compare-tiers-tmp.mjs')
const compareScript = `
import { readFileSync } from 'node:fs';
import { parseCommissionCsv, isParseError } from '../src/lib/csv/parser.ts';
import { tierProducts } from '../src/lib/analysis/tierEngine.ts';
import { tierProductsMomentum } from '../src/lib/analysis/momentumMode.ts';

const text = readFileSync(new URL('../src/data/sample-commission.csv', import.meta.url), 'utf8');
const parsed = parseCommissionCsv(text);
if (isParseError(parsed)) throw new Error(parsed.message);
const inputs = parsed.products.map((p) => ({
  id: p.id,
  productName: p.productName,
  productId: p.productId,
  gmv: p.gmv,
  commission: p.commission,
  itemsSold: p.itemsSold,
  orderCount: p.orderCount,
  videosFilmed: 0,
  inRotation: true,
  isManual: false,
}));
const full = tierProducts(inputs);
const mom = tierProductsMomentum(inputs);
function fp(products) {
  return JSON.stringify(
    [...products]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((p) => ({ id: p.id, tier: p.tier, rankInTier: p.rankInTier })),
  );
}
process.stdout.write(JSON.stringify({ full: fp(full), momentum: fp(mom) }));
`
writeFileSync(compareScriptPath, compareScript)

const mainOut = execFileSync('npx', ['tsx', compareScriptPath], {
  cwd: worktree,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
})
const mainFp = JSON.parse(mainOut.trim())

const fullFpNow = JSON.stringify(
  fingerprint(fullNow, 'full').map(({ id, tier, rankInTier }) => ({
    id,
    tier,
    rankInTier,
  })),
)
const momFpNow = JSON.stringify(
  fingerprint(momNow, 'momentum').map(({ id, tier, rankInTier }) => ({
    id,
    tier,
    rankInTier,
  })),
)

const fullMatch = fullFpNow === mainFp.full
const momMatch = momFpNow === mainFp.momentum
const fullHasSop = fullNow.some((p) => p.sopTier != null)
const momHasSop = momNow.some((p) => p.sopTier != null)
const sopHasSop = sopNow.every((p) => p.sopTier != null)

console.log('\nFingerprint compare vs origin/main (same CSV inputs):')
console.log(`  full mode identical to main:     ${fullMatch}`)
console.log(`  momentum mode identical to main: ${momMatch}`)
console.log(`  full mode sets sopTier?:         ${fullHasSop}`)
console.log(`  momentum mode sets sopTier?:     ${momHasSop}`)
console.log(`  sop mode sets sopTier on all?:   ${sopHasSop}`)

console.log('\ntierEngine.ts diff vs origin/main (bytes):')
const teDiff = execFileSync(
  'git',
  ['diff', 'origin/main', '--', 'src/lib/analysis/tierEngine.ts'],
  { cwd: root, encoding: 'utf8' },
)
console.log(`  ${teDiff.length === 0 ? '0 (unchanged)' : teDiff.length}`)

console.log('\nmomentumMode.ts diff vs origin/main (sop wiring only):')
const mmDiff = execFileSync(
  'git',
  ['diff', 'origin/main', '--', 'src/lib/analysis/momentumMode.ts'],
  { cwd: root, encoding: 'utf8' },
)
console.log(mmDiff)

execFileSync('git', ['worktree', 'remove', '--force', worktree], {
  cwd: root,
  stdio: 'ignore',
})

if (!fullMatch || !momMatch || fullHasSop || momHasSop || !sopHasSop) {
  console.error('\nNO-LEAK CHECK FAILED')
  process.exit(1)
}

console.log('\n' + '='.repeat(72))
console.log('EVIDENCE COMPLETE — Band qualification applied; full/momentum unchanged vs main')
console.log('='.repeat(72))

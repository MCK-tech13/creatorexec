/**
 * SOP tier assignment from CSV aggregates — Top/Mid counts, bands, urgent, tie.
 *
 * Usage: npx tsx scripts/verify-sop-tier-assign.ts
 */
import assert from 'node:assert/strict'
import {
  assignSopWinnerBand,
  isSopUrgentSample,
  sopBandFromSopTier,
  sopTierToLegacyTier,
  tierProductsSop,
  SOP_ANCHOR_TIE_RATIO,
  SOP_FULL_TEST_VIDEOS,
} from '../src/lib/analysis/sopTierAssign'
import { computeSopScaling } from '../src/lib/analysis/sopTierEngine'
import { retierProductsForMode } from '../src/lib/analysis/momentumMode'
import {
  scheduleModeForDbColumn,
  embedAnalysisModeInSprintConfig,
  scheduleModeFromPersisted,
} from '../src/lib/catalog/catalogSprint'
import type { MergedProduct, SopTier } from '../src/types'

type Draft = Omit<MergedProduct, 'score' | 'tier' | 'rankInTier'>

function draft(
  overrides: Partial<Draft> & Pick<Draft, 'id' | 'productName' | 'commission'>,
): Draft {
  return {
    productId: overrides.id,
    gmv: overrides.commission * 10,
    itemsSold: Math.max(1, Math.round(overrides.commission / 3)),
    orderCount: 1,
    videosFilmed: 0,
    inRotation: true,
    isManual: false,
    ...overrides,
  }
}

function countBySop(products: MergedProduct[]): Record<SopTier, number> {
  const empty: Record<SopTier, number> = {
    Anchor: 0,
    Rotator: 0,
    Mid: 0,
    BandA: 0,
    BandB: 0,
    NewSample: 0,
    Urgent: 0,
    Retired: 0,
  }
  for (const p of products) {
    const t = p.sopTier
    if (t) empty[t] += 1
  }
  return empty
}

console.log('SOP tier assignment verification')

// --- 30×3 Top / Mid product counts ---
{
  const products: Draft[] = []
  for (let i = 0; i < 40; i++) {
    products.push(
      draft({
        id: `p${i}`,
        productName: `Product ${String(i).padStart(2, '0')}`,
        // Spaced so rank 5 is not within 90% of rank 4 (avoids anchor tie pull-up).
        commission: 500 - i * 50,
        itemsSold: 20,
        videosFilmed: i < 25 ? SOP_FULL_TEST_VIDEOS : 0,
      }),
    )
  }
  const { products: tiered, meta } = tierProductsSop(products, {
    dailyVolume: 30,
    sprintDays: 3,
  })
  assert.equal(meta.anchorCount, 4, '30×3 anchor product count')
  assert.equal(meta.rotatorCount, 6, '30×3 rotator product count')
  assert.equal(meta.midCount, 15, '30×3 mid product count')
  const counts = countBySop(tiered)
  assert.equal(counts.Anchor, 4)
  assert.equal(counts.Rotator, 6)
  assert.equal(counts.Mid, 15)
  assert.equal(tiered.find((p) => p.id === 'p0')?.sopTier, 'Anchor')
  assert.equal(tiered.find((p) => p.id === 'p3')?.sopTier, 'Anchor')
  assert.equal(tiered.find((p) => p.id === 'p4')?.sopTier, 'Rotator')
  assert.equal(tiered.find((p) => p.id === 'p9')?.sopTier, 'Rotator')
  assert.equal(tiered.find((p) => p.id === 'p10')?.sopTier, 'Mid')
  assert.equal(tiered.find((p) => p.id === 'p24')?.sopTier, 'Mid')
  console.log('✓ 30×3 Top/Mid assignment (4 / 6 / 15)')
}

// --- Band A / Band B / Retired (outside Top/Mid) ---
{
  const thresholds = { sprintBandAThreshold: 15, sprintBandBThreshold: 5 }
  assert.equal(
    assignSopWinnerBand(
      { commission: 20, itemsSold: 5, videosFilmed: 6 },
      thresholds,
    ),
    'BandA',
  )
  assert.equal(
    assignSopWinnerBand(
      { commission: 8, itemsSold: 3, videosFilmed: 6 },
      thresholds,
    ),
    'BandB',
  )
  assert.equal(
    assignSopWinnerBand(
      { commission: 3, itemsSold: 2, videosFilmed: 6 },
      thresholds,
    ),
    'Retired',
  )
  // High-ticket override (≥$10/item) → Band B even below Band B total
  assert.equal(
    assignSopWinnerBand(
      { commission: 12, itemsSold: 1, videosFilmed: 6 },
      thresholds,
    ),
    'BandB',
  )
  // Incomplete test → null (caller uses NewSample / Urgent)
  assert.equal(
    assignSopWinnerBand(
      { commission: 50, itemsSold: 10, videosFilmed: 3 },
      thresholds,
    ),
    null,
  )
  console.log('✓ Band A / Band B / Retired + high-ticket override')
}

// --- Urgent sample (0 videos + deadline ≤4 days) ---
{
  const asOf = new Date('2026-07-20T12:00:00Z')
  assert.equal(
    isSopUrgentSample(
      { videosFilmed: 0, firstVideoDeadline: '2026-07-22' },
      asOf,
    ),
    true,
  )
  assert.equal(
    isSopUrgentSample(
      { videosFilmed: 1, firstVideoDeadline: '2026-07-22' },
      asOf,
    ),
    false,
  )
  assert.equal(
    isSopUrgentSample(
      { videosFilmed: 0, firstVideoDeadline: '2026-07-30' },
      asOf,
    ),
    false,
  )

  const { products: tiered } = tierProductsSop(
    [
      // Fill Top/Mid so urgent lands outside
      ...Array.from({ length: 25 }, (_, i) =>
        draft({
          id: `top${i}`,
          productName: `Top ${i}`,
          commission: 200 - i,
          itemsSold: 40,
          videosFilmed: 6,
        }),
      ),
      draft({
        id: 'urgent1',
        productName: 'Urgent Sample',
        commission: 1,
        itemsSold: 1,
        videosFilmed: 0,
        firstVideoDeadline: '2026-07-22',
      }),
    ],
    { dailyVolume: 30, sprintDays: 3, asOfDate: asOf },
  )
  assert.equal(tiered.find((p) => p.id === 'urgent1')?.sopTier, 'Urgent')
  assert.equal(tiered.find((p) => p.id === 'urgent1')?.tier, 'Test')
  console.log('✓ Urgent sample assignment')
}

// --- Optional ~10% Anchor tie pull-up ---
{
  // 4 anchors at 100, challenger within 90% of last Anchor
  const tied = [
    draft({ id: 'a1', productName: 'A1', commission: 100, itemsSold: 20, videosFilmed: 6 }),
    draft({ id: 'a2', productName: 'A2', commission: 100, itemsSold: 20, videosFilmed: 6 }),
    draft({ id: 'a3', productName: 'A3', commission: 100, itemsSold: 20, videosFilmed: 6 }),
    draft({ id: 'a4', productName: 'A4', commission: 100, itemsSold: 20, videosFilmed: 6 }),
    draft({
      id: 'tie',
      productName: 'Tie Challenger',
      commission: 100 * SOP_ANCHOR_TIE_RATIO,
      itemsSold: 20,
      videosFilmed: 6,
    }),
    ...Array.from({ length: 20 }, (_, i) =>
      draft({
        id: `r${i}`,
        productName: `Rest ${i}`,
        commission: 50 - i,
        itemsSold: 10,
        videosFilmed: 6,
      }),
    ),
  ]
  const { products: tiered, meta } = tierProductsSop(tied, {
    dailyVolume: 30,
    sprintDays: 3,
  })
  assert.equal(meta.anchorTieExpanded, true)
  assert.equal(meta.anchorCount, 5)
  assert.equal(meta.rotatorCount, 5) // one rotator slot sacrificed
  assert.equal(tiered.find((p) => p.id === 'tie')?.sopTier, 'Anchor')
  console.log('✓ Anchor ~10% tie pull-up')
}

// --- Legacy tier mapping + sopBand metadata ---
{
  assert.equal(sopTierToLegacyTier('Anchor'), 'Anchor')
  assert.equal(sopTierToLegacyTier('Rotator'), 'Rising')
  assert.equal(sopTierToLegacyTier('Mid'), 'Rising')
  assert.equal(sopTierToLegacyTier('BandA'), 'Test')
  assert.equal(sopTierToLegacyTier('BandB'), 'Test')
  assert.equal(sopTierToLegacyTier('NewSample'), 'Test')
  assert.equal(sopTierToLegacyTier('Urgent'), 'Test')
  assert.equal(sopTierToLegacyTier('Retired'), 'Cut')

  assert.equal(sopBandFromSopTier('BandA'), 'A')
  assert.equal(sopBandFromSopTier('BandB'), 'B')
  assert.equal(sopBandFromSopTier('Anchor'), null)
  assert.equal(sopBandFromSopTier('Rotator'), null)
  assert.equal(sopBandFromSopTier('Mid'), null)
  assert.equal(sopBandFromSopTier('NewSample'), null)
  assert.equal(sopBandFromSopTier('Urgent'), null)
  assert.equal(sopBandFromSopTier('Retired'), null)
  console.log('✓ Visible tier mapping + sopBand metadata (Band only on Test winners)')
}

// --- retierProductsForMode('sop') wiring; full/momentum untouched ---
{
  const inputs = [
    draft({ id: 'x1', productName: 'X1', commission: 80, itemsSold: 20, videosFilmed: 6 }),
    draft({ id: 'x2', productName: 'X2', commission: 10, itemsSold: 5, videosFilmed: 0 }),
  ].map((p) => ({
    ...p,
    score: 0,
    tier: 'Test' as const,
    rankInTier: 0,
  }))

  const sop = retierProductsForMode(inputs, 'sop', {
    dailyVolume: 30,
    sprintDays: 3,
  })
  assert.ok(sop.every((p) => p.sopTier), 'sop mode sets sopTier')
  assert.equal(sop.find((p) => p.id === 'x1')?.sopTier, 'Anchor')

  const full = retierProductsForMode(inputs, 'full')
  assert.ok(full.every((p) => p.sopTier === undefined), 'full mode leaves sopTier unset')
  const momentum = retierProductsForMode(inputs, 'momentum')
  assert.ok(
    momentum.every((p) => p.sopTier === undefined),
    'momentum mode leaves sopTier unset',
  )
  console.log('✓ retierProductsForMode sop / full / momentum paths')
}

// --- DB persist helpers (sop via analysisMode, column stays full) ---
{
  assert.equal(scheduleModeForDbColumn('sop'), 'full')
  assert.equal(scheduleModeForDbColumn('momentum'), 'momentum')
  assert.equal(scheduleModeForDbColumn('full'), 'full')
  const embedded = embedAnalysisModeInSprintConfig(
    { videosPerDay: 30, sprintDays: 3 },
    'sop',
  )
  assert.equal(embedded.analysisMode, 'sop')
  assert.equal(
    scheduleModeFromPersisted('full', embedded),
    'sop',
  )
  assert.equal(
    scheduleModeFromPersisted('momentum', { videosPerDay: 10, sprintDays: 7 }),
    'momentum',
  )
  const stripped = embedAnalysisModeInSprintConfig(embedded, 'full')
  assert.equal(
    (stripped as { analysisMode?: string }).analysisMode,
    undefined,
  )
  console.log('✓ scheduleMode DB persistence helpers')
}

// --- Overflow past Top/Mid budget → Band A/B/Retired / NewSample ---
{
  const topMidBudget =
    computeSopScaling({ dailyVolume: 30, sprintDays: 3 }).products.anchorProductCount +
    computeSopScaling({ dailyVolume: 30, sprintDays: 3 }).products.rotatorProductCount +
    computeSopScaling({ dailyVolume: 30, sprintDays: 3 }).products.midProductCount
  assert.equal(topMidBudget, 25, '30×3 Top+Mid budget is 4+6+15=25')

  const products: Draft[] = []
  // 25 Top/Mid seats — steep drop after Anchors so ~10% tie pull-up does not fire
  for (let i = 0; i < 25; i++) {
    products.push(
      draft({
        id: `top-${i}`,
        productName: `TopEarn ${String(i).padStart(2, '0')}`,
        // ranks 1–4: 400/350/300/250; rank 5: 100 (< 90% of 250)
        commission: i < 4 ? 400 - i * 50 : 100 - (i - 4),
        itemsSold: 40,
        videosFilmed: 6,
      }),
    )
  }
  // 7 overflow rows (ranks 26+)
  products.push(
    draft({
      id: 'ov-banda',
      productName: 'Overflow BandA',
      commission: 24.4,
      itemsSold: 7,
      gmv: 139.93,
      videosFilmed: 6,
    }),
    draft({
      id: 'ov-bandb',
      productName: 'Overflow BandB',
      commission: 14.11,
      itemsSold: 4,
      gmv: 90,
      videosFilmed: 6,
    }),
    draft({
      id: 'ov-retired-cpi',
      productName: 'Overflow Retired CPI',
      commission: 9.6,
      itemsSold: 6,
      gmv: 60,
      videosFilmed: 6,
    }),
    draft({
      id: 'ov-highticket',
      productName: 'Overflow HighTicket',
      commission: 12,
      itemsSold: 1,
      gmv: 80,
      videosFilmed: 6,
    }),
    draft({
      id: 'ov-bandb2',
      productName: 'Overflow BandB2',
      commission: 6.75,
      itemsSold: 1,
      gmv: 45,
      videosFilmed: 6,
    }),
    draft({
      id: 'ov-newsample',
      productName: 'Overflow NewSample',
      commission: 8,
      itemsSold: 3,
      gmv: 40,
      videosFilmed: 2,
    }),
    draft({
      id: 'ov-retired-low',
      productName: 'Overflow Retired Low',
      commission: 3.7,
      itemsSold: 2,
      gmv: 24,
      videosFilmed: 6,
    }),
  )
  assert.equal(products.length, 32)

  const { products: tiered, meta } = tierProductsSop(products, {
    dailyVolume: 30,
    sprintDays: 3,
  })
  assert.equal(meta.anchorTieExpanded, false, 'overflow fixture must not trigger anchor tie')
  assert.equal(meta.anchorCount + meta.rotatorCount + meta.midCount, 25)

  const expect: Record<string, SopTier> = {
    'ov-banda': 'BandA',
    'ov-bandb': 'BandB',
    'ov-retired-cpi': 'Retired',
    'ov-highticket': 'BandB',
    'ov-bandb2': 'BandB',
    'ov-newsample': 'NewSample',
    'ov-retired-low': 'Retired',
  }
  for (const [id, want] of Object.entries(expect)) {
    const p = tiered.find((x) => x.id === id)
    assert.ok(p, `missing ${id}`)
    assert.equal(
      p!.sopTier,
      want,
      `${id}: expected ${want}, got ${p!.sopTier} (commission=${p!.commission})`,
    )
    assert.ok(
      p!.sopTier !== 'Anchor' && p!.sopTier !== 'Rotator' && p!.sopTier !== 'Mid',
      `${id} must not land in Top/Mid`,
    )
    assert.equal(p!.tier, sopTierToLegacyTier(want), `${id} visible tier`)
    assert.equal(p!.sopBand ?? null, sopBandFromSopTier(want), `${id} sopBand`)
    if (want === 'BandA' || want === 'BandB') {
      assert.equal(p!.tier, 'Test', `${id} Band winners must display as Test`)
      assert.ok(p!.sopBand === 'A' || p!.sopBand === 'B')
    } else {
      assert.equal(p!.sopBand ?? null, null, `${id} non-Band must have sopBand null`)
    }
  }
  // Rising (Rotator/Mid) never carries Band metadata
  for (const p of tiered.filter((x) => x.tier === 'Rising')) {
    assert.equal(p.sopBand ?? null, null, `${p.id} Rising must not have sopBand`)
  }
  console.log(
    `✓ Overflow past Top/Mid (${products.length} products > ${topMidBudget} budget) → Band/Retired/NewSample`,
  )
}

console.log('\nAll SOP tier assignment checks passed.')

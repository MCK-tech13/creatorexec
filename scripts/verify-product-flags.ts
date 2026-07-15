/**
 * Run: npx tsx scripts/verify-product-flags.ts
 */
import type { MergedProduct, SprintConfig } from '../src/types'
import {
  buildProductFlags,
  computeProductFlagsForReview,
  computeSlowingAnchors,
  computeStalledProducts,
} from '../src/lib/sprint/productFlags'
import { snapshotFromProducts } from '../src/types/sprintReview'

function mockProduct(
  id: string,
  name: string,
  tier: MergedProduct['tier'],
  commission: number,
  videosFilmed = 0,
): MergedProduct {
  return {
    id,
    productName: name,
    productId: `pid-${id}`,
    gmv: commission * 10,
    commission,
    itemsSold: tier === 'Test' ? 1 : 8,
    orderCount: 1,
    videosFilmed,
    score: commission,
    tier,
    rankInTier: 1,
    inRotation: true,
    isManual: false,
  }
}

function productKey(product: { id: string; productId: string }): string {
  return product.productId
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function runStalledTests(): void {
  const config: SprintConfig = { videosPerDay: 5, sprintDays: 7 }

  const sprintMinus2 = snapshotFromProducts(
    [mockProduct('s1', 'Stuck Balm', 'Test', 20)],
    config,
    'full',
    'week-1.csv',
    productKey,
  )
  const sprintMinus1 = snapshotFromProducts(
    [mockProduct('s1', 'Stuck Balm', 'Test', 22)],
    config,
    'full',
    'week-2.csv',
    productKey,
  )
  const current = [
    {
      key: 'pid-s1',
      productId: 'pid-s1',
      productName: 'Stuck Balm',
      tier: 'Test' as const,
    },
  ]

  const stalled = computeStalledProducts([sprintMinus1, sprintMinus2], current)
  assert(stalled.length === 1, 'Should flag product stalled for two sprint boundaries')
  assert(stalled[0]?.productName === 'Stuck Balm', 'Should identify stalled product by name')

  const moved = computeStalledProducts(
    [
      snapshotFromProducts(
        [mockProduct('r1', 'Climber Serum', 'Test', 20)],
        config,
        'full',
        'week-2.csv',
        productKey,
      ),
      snapshotFromProducts(
        [mockProduct('r1', 'Climber Serum', 'Test', 18)],
        config,
        'full',
        'week-1.csv',
        productKey,
      ),
    ],
    [
      {
        key: 'pid-r1',
        productId: 'pid-r1',
        productName: 'Climber Serum',
        tier: 'Rising',
      },
    ],
  )
  assert(moved.length === 0, 'Should not flag product that moved tiers')

  const anchor = computeStalledProducts([sprintMinus1, sprintMinus2], [
    {
      key: 'pid-s1',
      productId: 'pid-s1',
      productName: 'Stuck Balm',
      tier: 'Anchor',
    },
  ])
  assert(anchor.length === 0, 'Should not flag Anchor-tier products as stalled')

  console.log('Stalled product checks passed.')
}

function runSlowingTests(): void {
  const config: SprintConfig = { videosPerDay: 5, sprintDays: 7 }

  const sprint3 = snapshotFromProducts(
    [mockProduct('a1', 'Cooling Serum', 'Anchor', 200)],
    config,
    'full',
    'week-3.csv',
    productKey,
  )
  const sprint2 = snapshotFromProducts(
    [mockProduct('a1', 'Cooling Serum', 'Anchor', 160)],
    config,
    'full',
    'week-4.csv',
    productKey,
  )
  const sprint1 = snapshotFromProducts(
    [mockProduct('a1', 'Cooling Serum', 'Anchor', 120)],
    config,
    'full',
    'week-5.csv',
    productKey,
  )
  const current = [
    {
      key: 'pid-a1',
      productId: 'pid-a1',
      productName: 'Cooling Serum',
      tier: 'Anchor' as const,
      commission: 90,
    },
  ]

  const slowing = computeSlowingAnchors([sprint1, sprint2, sprint3], current)
  assert(slowing.length === 1, 'Should flag Anchor with three consecutive commission declines')
  assert(slowing[0]?.productName === 'Cooling Serum', 'Should identify slowing Anchor by name')

  const flat = computeSlowingAnchors(
    [
      snapshotFromProducts(
        [mockProduct('a2', 'Steady Oil', 'Anchor', 100)],
        config,
        'full',
        'week-3.csv',
        productKey,
      ),
      snapshotFromProducts(
        [mockProduct('a2', 'Steady Oil', 'Anchor', 95)],
        config,
        'full',
        'week-4.csv',
        productKey,
      ),
      snapshotFromProducts(
        [mockProduct('a2', 'Steady Oil', 'Anchor', 90)],
        config,
        'full',
        'week-5.csv',
        productKey,
      ),
    ],
    [
      {
        key: 'pid-a2',
        productId: 'pid-a2',
        productName: 'Steady Oil',
        tier: 'Anchor',
        commission: 86,
      },
    ],
  )
  assert(flat.length === 0, 'Should not flag product without three 15%+ declines')

  console.log('Slowing Anchor checks passed.')
}

function runIntegrationTests(): void {
  const config: SprintConfig = { videosPerDay: 5, sprintDays: 7 }

  const history = [
    snapshotFromProducts(
      [
        mockProduct('a1', 'Cooling Serum', 'Anchor', 120),
        mockProduct('s1', 'Stuck Balm', 'Test', 24),
      ],
      config,
      'full',
      'week-5.csv',
      productKey,
    ),
    snapshotFromProducts(
      [
        mockProduct('a1', 'Cooling Serum', 'Anchor', 160),
        mockProduct('s1', 'Stuck Balm', 'Test', 22),
      ],
      config,
      'full',
      'week-4.csv',
      productKey,
    ),
    snapshotFromProducts(
      [mockProduct('a1', 'Cooling Serum', 'Anchor', 200)],
      config,
      'full',
      'week-3.csv',
      productKey,
    ),
    snapshotFromProducts(
      [mockProduct('s1', 'Stuck Balm', 'Test', 20)],
      config,
      'full',
      'week-2.csv',
      productKey,
    ),
  ]

  const liveProducts = [
    mockProduct('a1', 'Cooling Serum', 'Anchor', 90),
    mockProduct('s1', 'Stuck Balm', 'Test', 24),
    mockProduct('r1', 'Fresh Mask', 'Rising', 40),
  ]

  const flags = buildProductFlags(history, liveProducts)
  assert(flags.stalled.has('pid-s1'), 'buildProductFlags should flag stalled Test product')
  assert(flags.slowingAnchors.has('pid-a1'), 'buildProductFlags should flag slowing Anchor')

  const endSnapshot = snapshotFromProducts(
    [
      mockProduct('a1', 'Cooling Serum', 'Anchor', 90),
      mockProduct('s1', 'Stuck Balm', 'Test', 24),
    ],
    config,
    'full',
    'week-6.csv',
    productKey,
  )

  const reviewFlags = computeProductFlagsForReview(history.slice(0, 3), endSnapshot)
  assert(
    reviewFlags.slowingAnchorProducts.some((product) => product.productName === 'Cooling Serum'),
    'Review flags should include slowing Anchor at sprint end',
  )
  assert(
    reviewFlags.stalledProducts.some((product) => product.productName === 'Stuck Balm'),
    'Review flags should include stalled product at sprint end',
  )

  console.log('Integration checks passed.')
}

function runSnapshotGmvTests(): void {
  const config: SprintConfig = { videosPerDay: 5, sprintDays: 7 }
  const snapshot = snapshotFromProducts(
    [mockProduct('a1', 'Cooling Serum', 'Anchor', 120)],
    config,
    'full',
    'week-1.csv',
    productKey,
  )

  assert(snapshot.products[0]?.gmv === 1200, 'Snapshots should persist GMV going forward')
  console.log('Snapshot GMV checks passed.')
}

try {
  runStalledTests()
  runSlowingTests()
  runIntegrationTests()
  runSnapshotGmvTests()
  console.log('\nAll product flag verification checks passed.')
} catch (error) {
  console.error('\nVERIFICATION FAILED:', error)
  process.exit(1)
}

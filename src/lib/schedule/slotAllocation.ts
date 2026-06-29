import type { MergedProduct } from '../../types'

export type ScheduleTier = 'Anchor' | 'Rising' | 'Test'

export interface ProductSlotAllocation {
  product: MergedProduct
  tier: ScheduleTier
  slots: number
}

const TOP3_SHARE = 0.3
const REMAINING_ANCHOR_SHARE = 0.2
const RISING_SHARE = 0.3
const TEST_SHARE = 0.2

function sortedByCommission(products: MergedProduct[]): MergedProduct[] {
  return [...products].sort((a, b) => b.commission - a.commission)
}

/** Split `pool` slots across `products` with at least `minEach` per product when pool allows. */
export function distributeWithMinimum(
  products: MergedProduct[],
  pool: number,
  minEach: number,
): { counts: Map<string, number>; unused: number } {
  const counts = new Map<string, number>()
  if (products.length === 0 || pool <= 0) {
    return { counts, unused: pool }
  }

  let remaining = pool

  if (minEach > 0) {
    const minRecipients = Math.min(products.length, remaining)
    if (remaining >= products.length) {
      for (const product of products) {
        counts.set(product.id, minEach)
        remaining -= minEach
      }
    } else {
      for (let i = 0; i < minRecipients; i++) {
        counts.set(products[i].id, minEach)
      }
      return { counts, unused: 0 }
    }
  }

  let index = 0
  while (remaining > 0) {
    const product = products[index % products.length]
    counts.set(product.id, (counts.get(product.id) ?? 0) + 1)
    remaining -= 1
    index += 1
  }

  return { counts, unused: 0 }
}

/** Top 3 anchors: even split; 1/day each when volume allows. */
function allocateTopAnchors(
  pool: number,
  topAnchors: MergedProduct[],
  sprintDays: number,
): { counts: Map<string, number>; unused: number } {
  const counts = new Map<string, number>()
  if (topAnchors.length === 0 || pool <= 0) {
    return { counts, unused: pool }
  }

  const n = topAnchors.length
  const dailyMinimum = n * sprintDays

  if (pool >= dailyMinimum) {
    for (const product of topAnchors) {
      counts.set(product.id, sprintDays)
    }
    let extra = pool - dailyMinimum
    let index = 0
    while (extra > 0) {
      const product = topAnchors[index % n]
      counts.set(product.id, counts.get(product.id)! + 1)
      extra -= 1
      index += 1
    }
    return { counts, unused: 0 }
  }

  const base = Math.floor(pool / n)
  let remainder = pool % n
  for (const product of topAnchors) {
    const add = base + (remainder > 0 ? 1 : 0)
    counts.set(product.id, add)
    if (remainder > 0) remainder -= 1
  }

  return { counts, unused: 0 }
}

/** Test tier: at most 1 slot per product, commission priority when pool is tight. */
export function allocateTestProducts(
  pool: number,
  tests: MergedProduct[],
): { counts: Map<string, number>; unused: number } {
  const counts = new Map<string, number>()
  if (tests.length === 0 || pool <= 0) {
    return { counts, unused: pool }
  }

  const recipients = Math.min(tests.length, pool)
  for (let i = 0; i < recipients; i++) {
    counts.set(tests[i].id, 1)
  }

  return { counts, unused: pool - recipients }
}

function mergeCounts(target: Map<string, number>, source: Map<string, number>): void {
  for (const [id, slots] of source) {
    target.set(id, (target.get(id) ?? 0) + slots)
  }
}

function sumCounts(counts: Map<string, number>): number {
  let total = 0
  for (const slots of counts.values()) total += slots
  return total
}

/** Redistribute unused tier pool slots to anchor products (top 3 first, then rest). */
function redistributeToAnchors(
  counts: Map<string, number>,
  bonus: number,
  topAnchors: MergedProduct[],
  remainingAnchors: MergedProduct[],
  fallback: MergedProduct[] = [],
): void {
  if (bonus <= 0) return

  const anchorOrder = [...topAnchors, ...remainingAnchors]
  const recipients =
    anchorOrder.length > 0 ? anchorOrder : sortedByCommission(fallback)
  if (recipients.length === 0) return

  let index = 0
  let left = bonus
  while (left > 0) {
    const product = recipients[index % recipients.length]
    counts.set(product.id, (counts.get(product.id) ?? 0) + 1)
    left -= 1
    index += 1
  }
}

export interface TierPools {
  top3: number
  remainingAnchors: number
  rising: number
  test: number
  anchorBonus: number
}

export function computeTierPools(remainingSlots: number): TierPools {
  if (remainingSlots <= 0) {
    return { top3: 0, remainingAnchors: 0, rising: 0, test: 0, anchorBonus: 0 }
  }

  const top3 = Math.floor(remainingSlots * TOP3_SHARE)
  const remainingAnchors = Math.floor(remainingSlots * REMAINING_ANCHOR_SHARE)
  const rising = Math.floor(remainingSlots * RISING_SHARE)
  const test = Math.floor(remainingSlots * TEST_SHARE)
  const allocated = top3 + remainingAnchors + rising + test
  const anchorBonus = remainingSlots - allocated

  return { top3, remainingAnchors, rising, test, anchorBonus }
}

export function computeProductSlotAllocations(
  anchors: MergedProduct[],
  rising: MergedProduct[],
  tests: MergedProduct[],
  totalSlots: number,
  deadlineSlotsNeeded: number,
  sprintDays: number,
): ProductSlotAllocation[] {
  const remainingSlots = Math.max(0, totalSlots - deadlineSlotsNeeded)
  const pools = computeTierPools(remainingSlots)

  const sortedAnchors = sortedByCommission(anchors)
  const topAnchors = sortedAnchors.slice(0, 3)
  const remainingAnchorProducts = sortedAnchors.slice(3)
  const sortedRising = sortedByCommission(rising)
  const sortedTests = sortedByCommission(tests)

  const allCounts = new Map<string, number>()

  const top3 = allocateTopAnchors(pools.top3, topAnchors, sprintDays)
  mergeCounts(allCounts, top3.counts)

  const remAnchors = distributeWithMinimum(remainingAnchorProducts, pools.remainingAnchors, 1)
  mergeCounts(allCounts, remAnchors.counts)

  const risingAlloc = distributeWithMinimum(sortedRising, pools.rising, 1)
  mergeCounts(allCounts, risingAlloc.counts)

  const testAlloc = allocateTestProducts(pools.test, sortedTests)
  mergeCounts(allCounts, testAlloc.counts)

  let anchorBonus =
    pools.anchorBonus + top3.unused + remAnchors.unused + risingAlloc.unused + testAlloc.unused

  redistributeToAnchors(
    allCounts,
    anchorBonus,
    topAnchors,
    remainingAnchorProducts,
    [...sortedRising, ...sortedTests],
  )

  const tierById = new Map<string, ScheduleTier>()
  for (const product of sortedAnchors) tierById.set(product.id, 'Anchor')
  for (const product of sortedRising) tierById.set(product.id, 'Rising')
  for (const product of sortedTests) tierById.set(product.id, 'Test')

  const productById = new Map<string, MergedProduct>()
  for (const product of [...sortedAnchors, ...sortedRising, ...sortedTests]) {
    productById.set(product.id, product)
  }

  const allocatedTotal = sumCounts(allCounts)
  const slack = remainingSlots - allocatedTotal
  if (slack > 0) {
    redistributeToAnchors(
      allCounts,
      slack,
      topAnchors,
      remainingAnchorProducts,
      [...sortedRising, ...sortedTests],
    )
  }

  const allocations: ProductSlotAllocation[] = []
  for (const [id, slots] of allCounts) {
    if (slots <= 0) continue
    const product = productById.get(id)
    const tier = tierById.get(id)
    if (product && tier) {
      allocations.push({ product, tier, slots })
    }
  }

  return allocations.sort((a, b) => {
    if (b.product.commission !== a.product.commission) {
      return b.product.commission - a.product.commission
    }
    return a.product.productName.localeCompare(b.product.productName)
  })
}

export function totalDeadlineSlotsNeeded(
  deadlineProducts: { videosRequired: number }[],
): number {
  return deadlineProducts.reduce((sum, item) => sum + Math.max(0, item.videosRequired), 0)
}

export { sumCounts }

import type { MergedProduct } from '../../types'
import { TIER_REVIEW_VIDEO_COUNT } from '../../types'
import {
  isTrialComplete,
  remainingTrialSlots,
  selectActiveTrialProducts,
} from './trialProgress'

export type ScheduleTier = 'Anchor' | 'Rising' | 'Test'

export interface ProductSlotAllocation {
  product: MergedProduct
  tier: ScheduleTier
  slots: number
}

/** Accounts with few Anchors prioritize testing over daily top-seller rotation. */
export const LOW_ANCHOR_THRESHOLD = 2

export const MAX_TEST_VIDEOS_PER_DAY = 2
export const MAX_PROVEN_VIDEOS_PER_DAY = 1
export const MAX_RETAINER_VIDEOS_PER_DAY = 2
export const MIN_TEST_SPREAD_DAYS = 3
export const PROVEN_TIER_MAX_PRODUCTS = 10
export const PROVEN_TIER_MIN_PRODUCTS = 4

export const TEST_VIDEO_GUARANTEE = TIER_REVIEW_VIDEO_COUNT

function sortedByCommission(products: MergedProduct[]): MergedProduct[] {
  return [...products].sort((a, b) => b.commission - a.commission)
}

export function isLowAnchorAccount(anchorCount: number): boolean {
  return anchorCount <= LOW_ANCHOR_THRESHOLD
}

/** ~3–4 appearances per 7-day week, scaled to sprint length. */
export function provenSlotsPerProduct(sprintDays: number): number {
  if (sprintDays <= 0) return 0
  return Math.max(1, Math.min(sprintDays, Math.round((sprintDays / 7) * 3.5)))
}

/** Lighter proven cadence when the account has few Anchors. */
export function lowAnchorProvenSlotsPerProduct(sprintDays: number): number {
  return Math.min(2, provenSlotsPerProduct(sprintDays))
}

export function selectProvenTierProducts(
  anchors: MergedProduct[],
  rising: MergedProduct[],
  lowAnchorMode: boolean,
): MergedProduct[] {
  const sortedAnchors = sortedByCommission(anchors)
  const sortedRising = sortedByCommission(rising)

  if (lowAnchorMode) {
    return [...sortedAnchors, ...sortedRising].slice(0, PROVEN_TIER_MAX_PRODUCTS)
  }

  const remainingAnchors = sortedAnchors.slice(3)
  const combined = [...remainingAnchors, ...sortedRising]
  if (combined.length === 0) return []

  const take = Math.min(PROVEN_TIER_MAX_PRODUCTS, combined.length)
  return combined.slice(0, take)
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
    if (remaining >= products.length * minEach) {
      for (const product of products) {
        counts.set(product.id, minEach)
        remaining -= minEach
      }
    } else {
      const recipients = Math.min(products.length, Math.floor(remaining / minEach))
      for (let i = 0; i < recipients; i++) {
        counts.set(products[i].id, minEach)
        remaining -= minEach
      }
      return { counts, unused: remaining }
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

/** Top anchors: target 1 slot per sprint day each; use only `pool` budget. */
function allocateTopAnchorsWithBudget(
  pool: number,
  topAnchors: MergedProduct[],
  sprintDays: number,
): { counts: Map<string, number>; unused: number } {
  const counts = new Map<string, number>()
  if (topAnchors.length === 0 || pool <= 0) {
    return { counts, unused: pool }
  }

  for (const product of topAnchors) {
    counts.set(product.id, 0)
  }

  let remaining = pool
  while (remaining > 0) {
    let progress = false
    for (const product of topAnchors) {
      const current = counts.get(product.id) ?? 0
      if (current >= sprintDays) continue
      counts.set(product.id, current + 1)
      remaining -= 1
      progress = true
      if (remaining <= 0) break
    }
    if (!progress) break
  }

  return { counts, unused: remaining }
}

/** Proven tier: target `slotsEach` per product; trim evenly when pool is tight. */
function allocateProvenTier(
  pool: number,
  products: MergedProduct[],
  slotsEach: number,
): { counts: Map<string, number>; unused: number } {
  const counts = new Map<string, number>()
  if (products.length === 0 || pool <= 0 || slotsEach <= 0) {
    return { counts, unused: pool }
  }

  const desired = products.length * slotsEach
  if (pool >= desired) {
    for (const product of products) {
      counts.set(product.id, slotsEach)
    }
    return { counts, unused: pool - desired }
  }

  for (const product of products) {
    counts.set(product.id, 0)
  }

  let remaining = pool
  while (remaining > 0) {
    let progress = false
    for (const product of products) {
      const current = counts.get(product.id) ?? 0
      if (current >= slotsEach) continue
      counts.set(product.id, current + 1)
      remaining -= 1
      progress = true
      if (remaining <= 0) break
    }
    if (!progress) break
  }

  return { counts, unused: remaining }
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

/** Round-robin bonus slots to highest-priority products first. */
function redistributeBonus(
  counts: Map<string, number>,
  bonus: number,
  priority: MergedProduct[],
): number {
  if (bonus <= 0 || priority.length === 0) return bonus

  let left = bonus
  let index = 0
  while (left > 0) {
    const product = priority[index % priority.length]
    counts.set(product.id, (counts.get(product.id) ?? 0) + 1)
    left -= 1
    index += 1
  }
  return 0
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
  const sortedAnchors = sortedByCommission(anchors)
  const sortedRising = sortedByCommission(rising)
  const sortedTests = sortedByCommission(tests)

  const lowAnchorMode = isLowAnchorAccount(sortedAnchors.length)
  const topAnchors = lowAnchorMode ? [] : sortedAnchors.slice(0, 3)
  const provenProducts = selectProvenTierProducts(sortedAnchors, sortedRising, lowAnchorMode)

  const allCounts = new Map<string, number>()

  // 1. Test products: remaining slots toward 6-video trial (capped per sprint).
  const activeTests = selectActiveTrialProducts(sortedTests)
  let testReserved = 0
  for (const product of activeTests) {
    const slots = remainingTrialSlots(product.videosFilmed)
    if (slots <= 0 || isTrialComplete(product.videosFilmed)) continue
    allCounts.set(product.id, slots)
    testReserved += slots
  }
  let flexBudget = remainingSlots - testReserved

  // 2. Top 3 anchors: 1 slot per sprint day each (skipped in low-anchor mode).
  const top3Budget = Math.max(0, flexBudget)
  const top3Alloc = allocateTopAnchorsWithBudget(top3Budget, topAnchors, sprintDays)
  mergeCounts(allCounts, top3Alloc.counts)
  flexBudget = top3Alloc.unused

  // 3. Proven tier: remaining anchors + top Rising (~3–4× per week).
  const provenEach = lowAnchorMode
    ? lowAnchorProvenSlotsPerProduct(sprintDays)
    : provenSlotsPerProduct(sprintDays)
  const provenBudget = Math.max(0, flexBudget)
  const provenAlloc = allocateProvenTier(provenBudget, provenProducts, provenEach)
  mergeCounts(allCounts, provenAlloc.counts)
  flexBudget = provenAlloc.unused

  // 4. Leftover capacity → Rising (not repeat Anchor/proven slots; tests keep step-1 guarantee).
  if (flexBudget > 0) {
    flexBudget = redistributeBonus(allCounts, flexBudget, sortedRising)
  }

  const tierById = new Map<string, ScheduleTier>()
  for (const product of sortedAnchors) tierById.set(product.id, 'Anchor')
  for (const product of sortedRising) tierById.set(product.id, 'Rising')
  for (const product of sortedTests) tierById.set(product.id, 'Test')

  const productById = new Map<string, MergedProduct>()
  for (const product of [...sortedAnchors, ...sortedRising, ...sortedTests]) {
    productById.set(product.id, product)
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

export function computeMomentumSlotAllocations(
  rising: MergedProduct[],
  tests: MergedProduct[],
  totalSlots: number,
  deadlineSlotsNeeded: number,
  sprintDays: number,
): ProductSlotAllocation[] {
  const remainingSlots = Math.max(0, totalSlots - deadlineSlotsNeeded)
  const sortedRising = sortedByCommission(rising)
  const sortedTests = sortedByCommission(tests)
  const allCounts = new Map<string, number>()

  const activeTests = selectActiveTrialProducts(sortedTests)
  let testReserved = 0
  for (const product of activeTests) {
    const slots = remainingTrialSlots(product.videosFilmed)
    if (slots <= 0 || isTrialComplete(product.videosFilmed)) continue
    allCounts.set(product.id, slots)
    testReserved += slots
  }
  let flexBudget = remainingSlots - testReserved

  // Rising products: lighter proven cadence; trim before touching test guarantee.
  const risingEach = lowAnchorProvenSlotsPerProduct(sprintDays)
  const risingAlloc = allocateProvenTier(Math.max(0, flexBudget), sortedRising, risingEach)
  mergeCounts(allCounts, risingAlloc.counts)
  flexBudget = risingAlloc.unused

  if (flexBudget > 0) {
    flexBudget = redistributeBonus(allCounts, flexBudget, sortedRising)
  }

  const tierById = new Map<string, 'Rising' | 'Test'>()
  for (const product of sortedRising) tierById.set(product.id, 'Rising')
  for (const product of sortedTests) tierById.set(product.id, 'Test')

  const productById = new Map<string, MergedProduct>()
  for (const product of [...sortedRising, ...sortedTests]) {
    productById.set(product.id, product)
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

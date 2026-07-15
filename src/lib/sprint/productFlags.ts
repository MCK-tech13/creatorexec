import type { MergedProduct, Tier } from '../../types'
import type { ProductFlagEntry, SprintProductSnapshot, SprintSnapshot } from '../../types/sprintReview'

function liveProductKey(product: MergedProduct): string {
  return product.productId && product.productId !== 'sample' ? product.productId : product.id
}

const STALLED_TIERS: Tier[] = ['Test', 'Rising']
const DECLINE_THRESHOLD = 0.15
const STALLED_BOUNDARY_COUNT = 2
const SLOWING_SPRINT_COUNT = 3

export interface ProductFlagSets {
  stalled: Set<string>
  slowingAnchors: Set<string>
  stalledProducts: ProductFlagEntry[]
  slowingAnchorProducts: ProductFlagEntry[]
}

function findSnapshotProduct(
  products: SprintProductSnapshot[],
  key: string,
): SprintProductSnapshot | undefined {
  return products.find((product) => product.key === key)
}

function isStalledTier(tier: Tier): boolean {
  return STALLED_TIERS.includes(tier)
}

function declinedAtLeast15Percent(previous: number, current: number): boolean {
  if (previous <= 0) return false
  return (current - previous) / previous <= -DECLINE_THRESHOLD
}

function hasConsecutiveDeclines(values: number[], sprintCount: number): boolean {
  if (values.length !== sprintCount + 1) return false
  for (let index = 0; index < sprintCount; index += 1) {
    if (!declinedAtLeast15Percent(values[index], values[index + 1])) {
      return false
    }
  }
  return true
}

function toFlagEntry(product: {
  key: string
  productId: string
  productName: string
  tier: Tier
}): ProductFlagEntry {
  return {
    key: product.key,
    productId: product.productId,
    productName: product.productName,
    tier: product.tier,
  }
}

export function computeStalledProducts(
  completedSprintEnds: SprintSnapshot[],
  currentProducts: Array<{
    key: string
    productId: string
    productName: string
    tier: Tier
  }>,
): ProductFlagEntry[] {
  if (completedSprintEnds.length < STALLED_BOUNDARY_COUNT) return []

  const recentEnd = completedSprintEnds[0]
  const priorEnd = completedSprintEnds[1]
  const flagged: ProductFlagEntry[] = []

  for (const current of currentProducts) {
    if (!isStalledTier(current.tier)) continue

    const recentSnapshot = findSnapshotProduct(recentEnd.products, current.key)
    const priorSnapshot = findSnapshotProduct(priorEnd.products, current.key)
    if (!recentSnapshot || !priorSnapshot) continue
    if (!isStalledTier(recentSnapshot.tier) || !isStalledTier(priorSnapshot.tier)) continue
    if (
      priorSnapshot.tier === recentSnapshot.tier &&
      recentSnapshot.tier === current.tier
    ) {
      flagged.push(toFlagEntry(current))
    }
  }

  return flagged.sort((a, b) => a.productName.localeCompare(b.productName))
}

export function computeSlowingAnchors(
  completedSprintEnds: SprintSnapshot[],
  currentProducts: Array<{
    key: string
    productId: string
    productName: string
    tier: Tier
    commission: number
  }>,
): ProductFlagEntry[] {
  if (completedSprintEnds.length < SLOWING_SPRINT_COUNT) return []

  const historyPoints = completedSprintEnds
    .slice(0, SLOWING_SPRINT_COUNT)
    .reverse()
    .map((snapshot) => snapshot.products)
  const flagged: ProductFlagEntry[] = []

  for (const current of currentProducts) {
    if (current.tier !== 'Anchor') continue

    const snapshotsAcrossPoints = [...historyPoints]
    const commissions: number[] = []

    let missingPoint = false
    for (const point of snapshotsAcrossPoints) {
      const snapshotProduct = findSnapshotProduct(point, current.key)
      if (!snapshotProduct || snapshotProduct.tier !== 'Anchor') {
        missingPoint = true
        break
      }
      commissions.push(snapshotProduct.commission)
    }

    if (missingPoint) continue

    commissions.push(current.commission)
    if (!hasConsecutiveDeclines(commissions, SLOWING_SPRINT_COUNT)) continue

    flagged.push(toFlagEntry(current))
  }

  return flagged.sort((a, b) => a.productName.localeCompare(b.productName))
}

export function computeProductFlagsForReview(
  completedSprintEnds: SprintSnapshot[],
  endSnapshot: SprintSnapshot,
): Pick<ProductFlagSets, 'stalledProducts' | 'slowingAnchorProducts'> {
  const currentProducts = endSnapshot.products.map((product) => ({
    key: product.key,
    productId: product.productId,
    productName: product.productName,
    tier: product.tier,
    commission: product.commission,
  }))

  return {
    stalledProducts: computeStalledProducts(completedSprintEnds, currentProducts),
    slowingAnchorProducts: computeSlowingAnchors(completedSprintEnds, currentProducts),
  }
}

export function buildProductFlags(
  completedSprintEnds: SprintSnapshot[],
  products: MergedProduct[],
): ProductFlagSets {
  const currentProducts = products.map((product) => ({
    key: liveProductKey(product),
    productId: product.productId,
    productName: product.productName,
    tier: product.tier,
    commission: product.commission,
  }))

  const stalledProducts = computeStalledProducts(completedSprintEnds, currentProducts)
  const slowingAnchorProducts = computeSlowingAnchors(completedSprintEnds, currentProducts)

  return {
    stalled: new Set(stalledProducts.map((product) => product.key)),
    slowingAnchors: new Set(slowingAnchorProducts.map((product) => product.key)),
    stalledProducts,
    slowingAnchorProducts,
  }
}

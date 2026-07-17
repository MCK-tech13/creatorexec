/**
 * Run: npx tsx scripts/verify-milestone-celebrations.ts
 */
import { findAnchorPromotions } from '../src/lib/celebrations/anchorPromotions'
import type { MergedProduct } from '../src/types'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function product(
  partial: Partial<MergedProduct> & Pick<MergedProduct, 'id' | 'productId' | 'productName' | 'tier'>,
): MergedProduct {
  return {
    gmv: 100,
    commission: 20,
    itemsSold: 10,
    orderCount: 10,
    videosFilmed: 6,
    score: 50,
    rankInTier: 1,
    inRotation: true,
    ...partial,
  }
}

function runAnchorDetection(): void {
  const previous = [
    product({ id: '1', productId: 'p1', productName: 'Glow Serum', tier: 'Rising' }),
    product({ id: '2', productId: 'p2', productName: 'Night Cream', tier: 'Anchor' }),
    product({ id: '3', productId: 'p3', productName: 'Lip Balm', tier: 'Test' }),
  ]
  const next = [
    product({ id: '1', productId: 'p1', productName: 'Glow Serum', tier: 'Anchor' }),
    product({ id: '2', productId: 'p2', productName: 'Night Cream', tier: 'Anchor' }),
    product({ id: '3', productId: 'p3', productName: 'Lip Balm', tier: 'Rising' }),
    product({ id: '4', productId: 'p4', productName: 'New Arrival', tier: 'Anchor' }),
  ]

  const promotions = findAnchorPromotions(previous, next)
  assert(promotions.length === 1, 'only Glow Serum should promote')
  assert(promotions[0]?.productName === 'Glow Serum', 'Glow Serum name')
  assert(findAnchorPromotions([], next).length === 0, 'no previous catalog → no promotions')
  assert(findAnchorPromotions(previous, previous).length === 0, 'unchanged → no promotions')

  console.log('Anchor promotion detection checks passed.')
}

runAnchorDetection()
console.log('verify-milestone-celebrations: all checks passed.')

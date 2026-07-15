import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { MergedProduct, Tier } from '../../types'
import { TIER_REVIEW_VIDEO_COUNT } from '../../types'
import { TierBadge } from './TierBadge'
import { ProductFlagBadge } from './ProductFlagBadge'
import { VideoProgressBar } from './VideoProgressBar'
import { isReadyForTierReview } from '../../lib/dashboard/videoProgress'
import { trialStorageKey } from '../../lib/schedule/trialProgressStorage'

type SortField = 'commission' | 'gmv' | 'itemsSold' | 'score'
type SortDir = 'asc' | 'desc'

interface ProductTableProps {
  products: MergedProduct[]
  activeTier: Tier | 'All'
  beginnerMode?: boolean
  advancedControlsOpen?: boolean
  stalledKeys?: Set<string>
  slowingAnchorKeys?: Set<string>
  onVideosFilmedChange: (productId: string, videosFilmed: number) => void
  onInRotationChange: (productId: string, inRotation: boolean) => void
  onMarkTrialPreviouslyCompleted: (productId: string) => void
}

function TestTrialStatus({
  product,
  onMarkTrialPreviouslyCompleted,
}: {
  product: MergedProduct
  onMarkTrialPreviouslyCompleted: (productId: string) => void
}) {
  if (product.tier !== 'Test') return null

  if (isReadyForTierReview(product.videosFilmed)) {
    return (
      <span className="label-caps mt-2 inline-flex text-emerald">
        Trial completed ({TIER_REVIEW_VIDEO_COUNT}+ videos)
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onMarkTrialPreviouslyCompleted(product.id)}
      className="btn-outline mt-2 w-full px-3 py-2 text-left font-body text-xs leading-snug sm:text-sm"
    >
      Test Previously Completed (6+ Videos Posted)
    </button>
  )
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

export function ProductTable({
  products,
  activeTier,
  beginnerMode = false,
  advancedControlsOpen = false,
  stalledKeys,
  slowingAnchorKeys,
  onVideosFilmedChange,
  onInRotationChange,
  onMarkTrialPreviouslyCompleted,
}: ProductTableProps) {
  const [sortField, setSortField] = useState<SortField>('commission')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const showRotationControls = !beginnerMode || advancedControlsOpen

  const filtered = useMemo(() => {
    const list =
      activeTier === 'All' ? products : products.filter((p) => p.tier === activeTier)
    return [...list].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1
      return (a[sortField] - b[sortField]) * mul
    })
  }, [products, activeTier, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === 'asc' ? (
      <ArrowUp className="inline h-3 w-3" />
    ) : (
      <ArrowDown className="inline h-3 w-3" />
    )
  }

  const productFlags = (product: MergedProduct) => {
    const key = trialStorageKey(product)
    const flags: Array<'stalled' | 'slowing'> = []
    if (stalledKeys?.has(key)) flags.push('stalled')
    if (slowingAnchorKeys?.has(key)) flags.push('slowing')
    return flags
  }

  const renderProductFlags = (product: MergedProduct) => {
    const flags = productFlags(product)
    if (flags.length === 0) return null
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {flags.map((flag) => (
          <ProductFlagBadge key={flag} kind={flag} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <ul className="divide-y divide-border-warm border border-border-warm md:hidden">
        {filtered.map((product) => {
          const isTopEarner = beginnerMode && product.tier === 'Anchor'
          return (
            <li
              key={product.id}
              className={`px-4 py-4 ${
                !product.inRotation && showRotationControls ? 'opacity-60' : ''
              } ${product.tier === 'Rising' ? 'border-t border-t-terracotta' : ''}`}
            >
              <p
                className={`line-clamp-2 font-body text-sm leading-snug text-ink ${
                  isTopEarner ? 'font-bold' : 'font-medium'
                }`}
              >
                {product.productName}
              </p>
              {product.isManual && (
                <span className="label-caps mt-1 inline-block">Manual</span>
              )}

              <div className="mt-2 flex items-center justify-between gap-3">
                <TierBadge tier={product.tier} showTooltip={beginnerMode} />
                <span className="shrink-0 font-body text-sm font-semibold tabular-nums text-emerald">
                  {formatCurrency(product.commission)}
                </span>
              </div>
              {renderProductFlags(product)}
              <TestTrialStatus
                product={product}
                onMarkTrialPreviouslyCompleted={onMarkTrialPreviouslyCompleted}
              />

              <p className="mt-1.5 font-body text-xs tabular-nums text-stone">
                GMV {formatCurrency(product.gmv)} · {product.itemsSold} sold
                {product.orderCount > 1 ? ` · ${product.orderCount} orders` : ''}
              </p>

              {showRotationControls && (
                <div className="mt-3 space-y-3 border-t border-border-warm pt-3">
                  <label className="flex items-center gap-2 font-body text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={product.inRotation}
                      onChange={(e) => onInRotationChange(product.id, e.target.checked)}
                      className="accent-checkbox h-4 w-4 border-border-warm"
                    />
                    In rotation
                  </label>
                  <div>
                    <span className="label-caps mb-2 block">Videos filmed</span>
                    <input
                      type="number"
                      min={0}
                      value={product.videosFilmed}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10)
                        onVideosFilmedChange(
                          product.id,
                          Number.isNaN(val) ? 0 : Math.max(0, val),
                        )
                      }}
                      className="input-field w-20 px-2 py-1.5 text-center"
                    />
                    <VideoProgressBar filmed={product.videosFilmed} />
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left font-body text-sm">
          <thead>
            <tr className="border-b border-border-warm">
              {showRotationControls && (
                <th className="label-caps px-5 py-4 text-left">In Rotation</th>
              )}
              <th className="label-caps px-5 py-4 text-left">Product</th>
              <th className="label-caps px-5 py-4 text-left">Tier</th>
              <th
                className="label-caps cursor-pointer px-5 py-4 text-left hover:text-ink"
                onClick={() => toggleSort('commission')}
              >
                Commission <SortIcon field="commission" />
              </th>
              <th
                className="label-caps cursor-pointer px-5 py-4 text-left hover:text-ink"
                onClick={() => toggleSort('gmv')}
              >
                GMV <SortIcon field="gmv" />
              </th>
              <th
                className="label-caps cursor-pointer px-5 py-4 text-left hover:text-ink"
                onClick={() => toggleSort('itemsSold')}
              >
                Items Sold <SortIcon field="itemsSold" />
              </th>
              {showRotationControls && (
                <th className="label-caps min-w-[200px] px-5 py-4 text-left">Videos Filmed</th>
              )}
              <th className="label-caps px-5 py-4 text-left">Orders</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => {
              const isTopEarner = beginnerMode && product.tier === 'Anchor'
              return (
                <tr
                  key={product.id}
                  className={`border-b border-border-warm ${
                    product.tier === 'Rising' ? 'border-t border-t-terracotta' : ''
                  } ${!product.inRotation && showRotationControls ? 'opacity-40' : ''}`}
                >
                  {showRotationControls && (
                    <td className="px-5 py-5">
                      <input
                        type="checkbox"
                        checked={product.inRotation}
                        onChange={(e) =>
                          onInRotationChange(product.id, e.target.checked)
                        }
                        className="accent-checkbox h-4 w-4 border-border-warm"
                        aria-label={`In rotation for ${product.productName}`}
                      />
                    </td>
                  )}
                  <td className="max-w-xs px-5 py-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {product.tier === 'Anchor' && (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald"
                            aria-hidden
                          />
                        )}
                        <p
                          className={`truncate text-ink ${
                            isTopEarner ? 'font-bold' : 'font-medium'
                          }`}
                        >
                          {product.productName}
                        </p>
                      </div>
                      {product.isManual && (
                        <span className="label-caps shrink-0">Manual</span>
                      )}
                      {productFlags(product).map((flag) => (
                        <ProductFlagBadge key={flag} kind={flag} />
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-5">
                    <TierBadge tier={product.tier} showTooltip={beginnerMode} />
                    <TestTrialStatus
                      product={product}
                      onMarkTrialPreviouslyCompleted={onMarkTrialPreviouslyCompleted}
                    />
                  </td>
                  <td className="px-5 py-5 font-semibold text-emerald">
                    {formatCurrency(product.commission)}
                  </td>
                  <td className="px-5 py-5 text-ink">{formatCurrency(product.gmv)}</td>
                  <td className="px-5 py-5 text-ink">{product.itemsSold}</td>
                  {showRotationControls && (
                    <td className="min-w-[200px] px-5 py-5">
                      <input
                        type="number"
                        min={0}
                        value={product.videosFilmed}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10)
                          onVideosFilmedChange(
                            product.id,
                            Number.isNaN(val) ? 0 : Math.max(0, val),
                          )
                        }}
                        className="input-field w-16 px-2 py-1.5 text-center"
                      />
                      <VideoProgressBar filmed={product.videosFilmed} />
                    </td>
                  )}
                  <td className="px-5 py-5 text-stone">
                    {product.orderCount > 1 ? product.orderCount : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="py-12 text-center font-body text-sm text-stone sm:py-20">
          No products in this tier.
        </p>
      )}
    </div>
  )
}

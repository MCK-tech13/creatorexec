import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { MergedProduct, Tier } from '../../types'
import { TierBadge } from './TierBadge'
import { VideoProgressBar } from './VideoProgressBar'

type SortField = 'commission' | 'gmv' | 'itemsSold' | 'score'
type SortDir = 'asc' | 'desc'

interface ProductTableProps {
  products: MergedProduct[]
  activeTier: Tier | 'All'
  beginnerMode?: boolean
  onVideosFilmedChange: (productId: string, videosFilmed: number) => void
  onInRotationChange: (productId: string, inRotation: boolean) => void
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
  onVideosFilmedChange,
  onInRotationChange,
}: ProductTableProps) {
  const [sortField, setSortField] = useState<SortField>('commission')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)

  const showRotationControls = !beginnerMode || showAdvancedControls

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

  return (
    <div>
      {beginnerMode && (
        <div className="mb-8 flex justify-end">
          <button
            type="button"
            onClick={() => setShowAdvancedControls((v) => !v)}
            className="link-elegant font-body text-sm text-ink"
          >
            {showAdvancedControls ? 'Hide advanced controls' : 'Show advanced controls'}
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
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
                    product.tier === 'Rising' ? 'border-t border-t-blush' : ''
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
                    </div>
                  </td>
                  <td className="px-5 py-5">
                    <TierBadge tier={product.tier} showTooltip={beginnerMode} />
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
        <p className="py-20 text-center font-body text-stone">No products in this tier.</p>
      )}
    </div>
  )
}

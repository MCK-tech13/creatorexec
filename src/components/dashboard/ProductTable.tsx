import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { MergedProduct, Tier } from '../../types'
import { TIER_STYLES } from '../../lib/theme/tierStyles'
import { VideoProgressBar } from './VideoProgressBar'

type SortField = 'commission' | 'gmv' | 'itemsSold' | 'score'
type SortDir = 'asc' | 'desc'

interface ProductTableProps {
  products: MergedProduct[]
  activeTier: Tier | 'All'
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
  onVideosFilmedChange,
  onInRotationChange,
}: ProductTableProps) {
  const [sortField, setSortField] = useState<SortField>('commission')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

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
    <div className="card-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left font-sans text-sm">
          <thead>
            <tr className="border-b border-border-warm text-stone">
              <th className="px-4 py-3 font-medium">In Rotation</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Tier</th>
              <th
                className="cursor-pointer px-4 py-3 font-medium hover:text-ink"
                onClick={() => toggleSort('commission')}
              >
                Commission <SortIcon field="commission" />
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-medium hover:text-ink"
                onClick={() => toggleSort('gmv')}
              >
                GMV <SortIcon field="gmv" />
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-medium hover:text-ink"
                onClick={() => toggleSort('itemsSold')}
              >
                Items Sold <SortIcon field="itemsSold" />
              </th>
              <th className="min-w-[140px] px-4 py-3 font-medium">Videos Filmed</th>
              <th className="px-4 py-3 font-medium">Orders</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => {
              const style = TIER_STYLES[product.tier]
              return (
                <tr
                  key={product.id}
                  className={`border-b border-border-warm/80 transition hover:bg-cream/60 ${
                    !product.inRotation ? 'opacity-60' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={product.inRotation}
                      onChange={(e) =>
                        onInRotationChange(product.id, e.target.checked)
                      }
                      className="h-4 w-4 rounded border-border-warm text-emerald focus:ring-emerald/30"
                      aria-label={`In rotation for ${product.productName}`}
                    />
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-ink">{product.productName}</p>
                      {product.isManual && (
                        <span className="shrink-0 rounded-full border border-emerald/30 bg-emerald/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald">
                          Manual
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text} ${style.border}`}
                    >
                      {product.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-emerald">{formatCurrency(product.commission)}</td>
                  <td className="px-4 py-3 text-ink">{formatCurrency(product.gmv)}</td>
                  <td className="px-4 py-3 text-ink">{product.itemsSold}</td>
                  <td className="px-4 py-3">
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
                      className="input-field w-16 px-2 py-1 text-center"
                    />
                    <VideoProgressBar filmed={product.videosFilmed} />
                  </td>
                  <td className="px-4 py-3 text-stone">
                    {product.orderCount > 1 ? product.orderCount : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <p className="px-4 py-8 text-center font-sans text-stone">No products in this tier.</p>
      )}
    </div>
  )
}

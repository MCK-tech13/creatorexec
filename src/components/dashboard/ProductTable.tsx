import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { MergedProduct, Tier } from '../../types'
import { TIER_BADGE_CLASS, TIER_STYLES } from '../../lib/theme/tierStyles'
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
    <div className="overflow-x-auto">
      <table className="w-full text-left font-sans text-sm">
        <thead>
          <tr className="border-b border-border-warm">
            <th className="label-caps px-5 py-4 text-left">In Rotation</th>
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
            <th className="label-caps min-w-[200px] px-5 py-4 text-left">Videos Filmed</th>
            <th className="label-caps px-5 py-4 text-left">Orders</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((product, index) => {
            const style = TIER_STYLES[product.tier]
            const rowBg = index % 2 === 0 ? 'bg-cream' : 'bg-cream-card'
            return (
              <tr
                key={product.id}
                className={`${rowBg} transition hover:bg-emerald-muted/40 ${
                  !product.inRotation ? 'opacity-50' : ''
                }`}
              >
                <td className="px-5 py-5">
                  <input
                    type="checkbox"
                    checked={product.inRotation}
                    onChange={(e) =>
                      onInRotationChange(product.id, e.target.checked)
                    }
                    className="accent-checkbox h-4 w-4 rounded border-border-warm"
                    aria-label={`In rotation for ${product.productName}`}
                  />
                </td>
                <td className="max-w-xs px-5 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-ink">{product.productName}</p>
                    {product.isManual && (
                      <span className="label-caps shrink-0 text-emerald">Manual</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-5">
                  <span className={`${TIER_BADGE_CLASS} ${style.bg} ${style.text} ${style.border}`}>
                    {product.tier}
                  </span>
                </td>
                <td className="px-5 py-5 font-semibold text-[#1a4a3a]">
                  {formatCurrency(product.commission)}
                </td>
                <td className="px-5 py-5 text-ink">{formatCurrency(product.gmv)}</td>
                <td className="px-5 py-5 text-ink">{product.itemsSold}</td>
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
                <td className="px-5 py-5 text-stone">
                  {product.orderCount > 1 ? product.orderCount : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {filtered.length === 0 && (
        <p className="py-16 text-center font-sans text-stone">No products in this tier.</p>
      )}
    </div>
  )
}

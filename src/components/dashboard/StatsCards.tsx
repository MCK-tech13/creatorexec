import type { MergedProduct } from '../../types'

interface StatsCardsProps {
  products: MergedProduct[]
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export function StatsCards({ products }: StatsCardsProps) {
  const totalCommission = products.reduce((s, p) => s + p.commission, 0)
  const totalGmv = products.reduce((s, p) => s + p.gmv, 0)
  const avgCommission = products.length ? totalCommission / products.length : 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
      <div
        className="stat-card-primary animate-stat-card px-6 py-5"
        style={{ animationDelay: '0s' }}
      >
        <span className="stat-label">Total Commission</span>
        <p className="font-display mt-3 text-[34px] leading-none font-bold text-stat-forest">
          {formatCurrency(totalCommission)}
        </p>
      </div>

      <div
        className="stat-card-secondary animate-stat-card px-6 py-5"
        style={{ animationDelay: '0.1s' }}
      >
        <span className="stat-label">Total GMV</span>
        <p className="font-display mt-3 text-[22px] leading-none font-bold text-stat-muted">
          {formatCurrency(totalGmv)}
        </p>
      </div>

      <div
        className="stat-card-secondary animate-stat-card px-6 py-5 sm:col-span-2 lg:col-span-1"
        style={{ animationDelay: '0.2s' }}
      >
        <span className="stat-label">Products / Avg</span>
        <p className="font-display mt-3 text-[22px] leading-none font-bold text-stat-muted">
          {products.length} · {formatCurrency(avgCommission)}
        </p>
      </div>
    </div>
  )
}

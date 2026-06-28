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

  const stats = [
    { label: 'Total Products', value: products.length.toString() },
    { label: 'Total Commission', value: formatCurrency(totalCommission) },
    { label: 'Total GMV', value: formatCurrency(totalGmv) },
    { label: 'Avg Commission', value: formatCurrency(avgCommission) },
  ]

  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="stat-card px-8 py-7">
          <span className="label-caps">{stat.label}</span>
          <p className="font-display mt-3 text-5xl font-bold tracking-tight text-ink lg:text-6xl">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}

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

const BORDER_ACCENTS = ['border-emerald', 'border-blush', 'border-emerald', 'border-blush'] as const

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
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`animate-stat-card border-t-2 ${BORDER_ACCENTS[index]} bg-white px-6 pt-5 pb-6`}
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <span className="label-caps">{stat.label}</span>
          <p className="font-display mt-4 text-5xl font-bold text-ink lg:text-6xl">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}

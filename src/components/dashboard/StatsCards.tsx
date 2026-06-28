import { DollarSign, Package, ShoppingBag, TrendingUp } from 'lucide-react'
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
    { label: 'Total Products', value: products.length.toString(), icon: Package, color: 'text-emerald' },
    { label: 'Total Commission', value: formatCurrency(totalCommission), icon: DollarSign, color: 'text-emerald-hover' },
    { label: 'Total GMV', value: formatCurrency(totalGmv), icon: ShoppingBag, color: 'text-tier-test' },
    { label: 'Avg Commission', value: formatCurrency(avgCommission), icon: TrendingUp, color: 'text-emerald' },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="card-panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-sans text-sm text-stone">{stat.label}</span>
            <stat.icon className={`h-5 w-5 ${stat.color}`} />
          </div>
          <p className="font-sans text-2xl font-semibold text-ink">{stat.value}</p>
        </div>
      ))}
    </div>
  )
}

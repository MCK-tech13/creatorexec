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
    <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5">
      <div
        className="stat-card-primary animate-stat-card min-w-0 px-4 py-4 sm:px-6 sm:py-5 lg:w-full lg:px-10 lg:py-8"
        style={{ animationDelay: '0s' }}
      >
        <span className="stat-label lg:text-sm lg:tracking-[0.18em]">Total Commission</span>
        <p className="font-display mt-2 min-w-0 text-[24px] leading-tight font-bold break-words text-stat-forest sm:mt-3 sm:text-[30px] md:text-[34px] md:leading-none lg:mt-4 lg:text-5xl lg:leading-none">
          {formatCurrency(totalCommission)}
        </p>
      </div>

      <div
        className="stat-card-secondary animate-stat-card min-w-0 px-4 py-4 sm:px-6 sm:py-5 lg:w-full lg:px-10 lg:py-8"
        style={{ animationDelay: '0.1s' }}
      >
        <span className="stat-label lg:text-sm lg:tracking-[0.18em]">Total GMV</span>
        <p className="font-display mt-2 min-w-0 text-base leading-tight font-bold break-words text-stat-muted sm:mt-3 sm:text-xl md:text-[22px] md:leading-none lg:mt-4 lg:text-4xl lg:leading-none">
          {formatCurrency(totalGmv)}
        </p>
      </div>

      <div
        className="stat-card-secondary animate-stat-card min-w-0 px-4 py-4 sm:col-span-2 sm:px-6 sm:py-5 lg:col-span-1 lg:w-full lg:px-10 lg:py-8"
        style={{ animationDelay: '0.2s' }}
      >
        <span className="stat-label lg:text-sm lg:tracking-[0.18em]">Products / Avg</span>
        <p className="font-display mt-2 min-w-0 text-base leading-tight font-bold break-words text-stat-muted sm:mt-3 sm:text-xl md:text-[22px] md:leading-none lg:mt-4 lg:text-4xl lg:leading-none">
          {products.length} · {formatCurrency(avgCommission)}
        </p>
      </div>
    </div>
  )
}

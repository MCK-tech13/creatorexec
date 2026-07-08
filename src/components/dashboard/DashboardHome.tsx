import { ArrowRight, Calendar, DollarSign, Search, Users } from 'lucide-react'
import type { MainSection } from '../../types'
import type {
  IncomeHomePreview,
  ProductScoutHomePreview,
  RetainerHomePreview,
  SprintHomePreview,
} from '../../lib/dashboard/homePreview'
import { formatIncomeSnapshot } from '../../lib/dashboard/homePreview'

interface DashboardHomeProps {
  sprint: SprintHomePreview
  retainers: RetainerHomePreview
  income: IncomeHomePreview
  productScout: ProductScoutHomePreview
  onNavigate: (section: MainSection) => void
}

interface FeatureCardProps {
  title: string
  icon: React.ReactNode
  onClick: () => void
  children: React.ReactNode
}

function FeatureCard({ title, icon, onClick, children }: FeatureCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full w-full flex-col border border-border-warm bg-white p-6 text-left transition hover:border-emerald/40 hover:shadow-[0_4px_20px_rgba(26,74,58,0.08)] sm:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center border border-border-warm bg-blush-tint text-emerald">
            {icon}
          </span>
          <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">{title}</h2>
        </div>
        <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-stone transition group-hover:translate-x-0.5 group-hover:text-emerald" />
      </div>
      <div className="mt-6 flex-1">{children}</div>
    </button>
  )
}

function SprintCardContent({ sprint }: { sprint: SprintHomePreview }) {
  if (sprint.kind === 'setup') {
    return (
      <div>
        <p className="font-body text-base font-semibold text-ink">{sprint.headline}</p>
        {sprint.detail && (
          <p className="mt-2 font-body text-sm leading-relaxed text-stone">{sprint.detail}</p>
        )}
        <p className="link-elegant mt-4 font-body text-sm text-emerald">Get started →</p>
      </div>
    )
  }

  return (
    <div>
      <p className="font-body text-base font-semibold text-ink">{sprint.headline}</p>
      {sprint.detail && (
        <p className="mt-2 font-body text-sm leading-relaxed text-stone">{sprint.detail}</p>
      )}
      {sprint.upcomingDays && sprint.upcomingDays.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-border-warm pt-4">
          {sprint.upcomingDays.map((day) => (
            <li
              key={day.label}
              className="flex items-center justify-between font-body text-sm text-stone"
            >
              <span>{day.label}</span>
              <span className="font-semibold tabular-nums text-ink">
                {day.count} video{day.count === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RetainerCardContent({ retainers }: { retainers: RetainerHomePreview }) {
  if (retainers.pipelineCount === 0) {
    return (
      <div>
        <p className="font-body text-base font-semibold text-ink">No deals yet</p>
        <p className="mt-2 font-body text-sm text-stone">
          Track partnerships from first pitch through payment.
        </p>
        <p className="link-elegant mt-4 font-body text-sm text-emerald">Add your first deal →</p>
      </div>
    )
  }

  return (
    <div>
      <p className="font-body text-base font-semibold text-ink">
        {retainers.pipelineCount} active deal{retainers.pipelineCount === 1 ? '' : 's'}
      </p>
      {retainers.activeCount > 0 && (
        <p className="mt-2 font-body text-sm text-stone">
          {retainers.activeCount} retainer{retainers.activeCount === 1 ? '' : 's'} syncing to
          sprint
        </p>
      )}
      {retainers.nextDeadlineLabel && (
        <p className="mt-3 font-body text-sm font-medium text-emerald">
          Next deadline: {retainers.nextDeadlineLabel}
        </p>
      )}
    </div>
  )
}

function IncomeCardContent({ income }: { income: IncomeHomePreview }) {
  const snapshot = formatIncomeSnapshot(income)

  if (!income.monthLabel) {
    return (
      <div>
        <p className="font-body text-base font-semibold text-ink">Log your first month</p>
        <p className="mt-2 font-body text-sm text-stone">
          Track GMV, commission, and brand deal income in one place.
        </p>
        <p className="link-elegant mt-4 font-body text-sm text-emerald">Open Income Tracker →</p>
      </div>
    )
  }

  return (
    <div>
      <p className="label-caps">{income.monthLabel}</p>
      <p className="mt-3 font-body text-base font-semibold text-ink">
        {snapshot ?? 'Month started — add your numbers'}
      </p>
      <p className="mt-2 font-body text-sm text-stone">Latest monthly snapshot</p>
    </div>
  )
}

function ProductScoutCardContent({ productScout }: { productScout: ProductScoutHomePreview }) {
  if (productScout.count === 0) {
    return (
      <div>
        <p className="font-body text-base font-semibold text-ink">Score your first product</p>
        <p className="mt-2 font-body text-sm text-stone">
          Enter TikTok Product trends data before you buy in.
        </p>
        <p className="link-elegant mt-4 font-body text-sm text-emerald">Start scouting →</p>
      </div>
    )
  }

  return (
    <div>
      <p className="font-body text-base font-semibold text-ink">
        {productScout.count} product{productScout.count === 1 ? '' : 's'} on your shortlist
      </p>
      <p className="mt-2 font-body text-sm text-stone">
        Compare pre-purchase scores and funnel recommendations.
      </p>
    </div>
  )
}

export function DashboardHome({
  sprint,
  retainers,
  income,
  productScout,
  onNavigate,
}: DashboardHomeProps) {
  return (
    <div className="fade-in">
      <div className="mb-8 sm:mb-10">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl md:text-4xl">
          Dashboard
        </h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-stone sm:text-base">
          Your TikTok Shop command center — jump into any workflow or pick up where you left off.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <FeatureCard
          title="Sprint"
          icon={<Calendar className="h-5 w-5" strokeWidth={2} />}
          onClick={() => onNavigate('sprint')}
        >
          <SprintCardContent sprint={sprint} />
        </FeatureCard>

        <FeatureCard
          title="Retainer Deals"
          icon={<Users className="h-5 w-5" strokeWidth={2} />}
          onClick={() => onNavigate('retainers')}
        >
          <RetainerCardContent retainers={retainers} />
        </FeatureCard>

        <FeatureCard
          title="Income Tracker"
          icon={<DollarSign className="h-5 w-5" strokeWidth={2} />}
          onClick={() => onNavigate('income')}
        >
          <IncomeCardContent income={income} />
        </FeatureCard>

        <FeatureCard
          title="Product Scout"
          icon={<Search className="h-5 w-5" strokeWidth={2} />}
          onClick={() => onNavigate('product-scout')}
        >
          <ProductScoutCardContent productScout={productScout} />
        </FeatureCard>
      </div>
    </div>
  )
}

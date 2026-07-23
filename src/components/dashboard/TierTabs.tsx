import type { MergedProduct, SopTier, Tier } from '../../types'
import {
  formatSopTierLabel,
  SOP_TIER_TAB_ORDER,
} from '../../lib/analysis/sopTierLabels'

export type DashboardTierFilter = Tier | SopTier | 'All'

interface TierTabsProps {
  products: MergedProduct[]
  activeTier: DashboardTierFilter
  onTierChange: (tier: DashboardTierFilter) => void
  /** When true, tabs use SOP ranks (Anchor/Rotator/Mid/Band…). */
  sopMode?: boolean
}

const LEGACY_TIERS: (Tier | 'All')[] = ['All', 'Anchor', 'Rising', 'Test', 'Cut']

export function TierTabs({
  products,
  activeTier,
  onTierChange,
  sopMode = false,
}: TierTabsProps) {
  if (sopMode) {
    const counts: Record<'All' | SopTier, number> = {
      All: products.length,
      Anchor: 0,
      Rotator: 0,
      Mid: 0,
      BandA: 0,
      BandB: 0,
      Urgent: 0,
      NewSample: 0,
      Retired: 0,
    }
    for (const p of products) {
      if (p.sopTier) counts[p.sopTier] += 1
    }
    const tabs: Array<'All' | SopTier> = ['All', ...SOP_TIER_TAB_ORDER]

    return (
      <div className="border-b border-border-warm">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          {tabs.map((tier) => {
            const isActive = activeTier === tier
            const label = tier === 'All' ? 'All' : formatSopTierLabel(tier)
            return (
              <button
                key={tier}
                type="button"
                onClick={() => onTierChange(tier)}
                className={`relative pb-5 font-body text-sm transition-colors ${
                  isActive ? 'font-bold text-ink' : 'font-normal text-stone hover:text-ink'
                }`}
              >
                {label}
                <span className={`ml-1.5 ${isActive ? 'text-stone' : 'text-grey'}`}>
                  ({counts[tier]})
                </span>
                {isActive && (
                  <span
                    className="absolute right-0 -bottom-px left-0 h-px bg-emerald"
                    aria-hidden
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const counts = {
    All: products.length,
    Anchor: products.filter((p) => p.tier === 'Anchor').length,
    Rising: products.filter((p) => p.tier === 'Rising').length,
    Test: products.filter((p) => p.tier === 'Test').length,
    Cut: products.filter((p) => p.tier === 'Cut').length,
  }

  return (
    <div className="border-b border-border-warm">
      <div className="flex flex-wrap gap-x-12 gap-y-2">
        {LEGACY_TIERS.map((tier) => {
          const isActive = activeTier === tier
          return (
            <button
              key={tier}
              type="button"
              onClick={() => onTierChange(tier)}
              className={`relative pb-5 font-body text-sm transition-colors ${
                isActive ? 'font-bold text-ink' : 'font-normal text-stone hover:text-ink'
              }`}
            >
              {tier}
              <span className={`ml-1.5 ${isActive ? 'text-stone' : 'text-grey'}`}>
                ({counts[tier]})
              </span>
              {isActive && (
                <span className="absolute right-0 -bottom-px left-0 h-px bg-emerald" aria-hidden />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { TIER_STYLES } from '../../lib/theme/tierStyles'

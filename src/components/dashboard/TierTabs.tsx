import type { MergedProduct, Tier } from '../../types'

interface TierTabsProps {
  products: MergedProduct[]
  activeTier: Tier | 'All'
  onTierChange: (tier: Tier | 'All') => void
}

const TIERS: (Tier | 'All')[] = ['All', 'Anchor', 'Rising', 'Test', 'Cut']

export function TierTabs({ products, activeTier, onTierChange }: TierTabsProps) {
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
        {TIERS.map((tier) => {
          const isActive = activeTier === tier
          return (
            <button
              key={tier}
              onClick={() => onTierChange(tier)}
              className={`relative pb-5 font-body text-sm transition-colors ${
                isActive
                  ? 'font-bold text-ink'
                  : 'font-normal text-stone hover:text-ink'
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

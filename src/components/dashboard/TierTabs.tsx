import type { MergedProduct, Tier } from '../../types'
import { TIER_TAB_STYLES } from '../../lib/theme/tierStyles'

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
    <div className="flex flex-wrap gap-2">
      {TIERS.map((tier) => {
        const isActive = activeTier === tier
        const style = tier !== 'All' ? TIER_TAB_STYLES[tier] : null
        return (
          <button
            key={tier}
            onClick={() => onTierChange(tier)}
            className={`rounded-full border px-4 py-1.5 font-sans text-sm font-medium transition ${
              isActive
                ? style
                  ? `${style.bg} ${style.text} ${style.border}`
                  : 'border-emerald/30 bg-emerald/10 text-emerald'
                : 'border-border-warm bg-cream-card text-stone hover:border-emerald/30 hover:text-ink'
            }`}
          >
            {tier}{' '}
            <span className="ml-1 opacity-70">({counts[tier]})</span>
          </button>
        )
      })}
    </div>
  )
}

export { TIER_STYLES } from '../../lib/theme/tierStyles'

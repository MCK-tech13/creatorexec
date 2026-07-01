import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

const SECTIONS = [
  {
    title: 'Bottom of Funnel — Purchase-Ready Content',
    body: 'Focus on Top Selling products from the TikTok Shop marketplace. Before committing, confirm that both Orders and Add to Carts are trending upward — this signals sustained demand, not a fading spike.',
  },
  {
    title: 'Middle of Funnel — Social Proof Content',
    body: 'Draw from Top Selling and/or Top Trending products. Prioritize listings where Add to Carts are climbing — this indicates growing interest and gives your content the best chance of converting viewers who are still in consideration mode.',
  },
  {
    title: 'Top of Funnel — Awareness Content',
    body: 'Look to Top Trending products or new launches from established brands. Rising Add to Cart numbers are your key signal here — they confirm the product is gaining traction and your content can ride that momentum.',
  },
] as const

interface ProductChoosingTipsProps {
  id?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ProductChoosingTips({ id, open: openProp, onOpenChange }: ProductChoosingTipsProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen

  const toggle = () => {
    const next = !open
    onOpenChange?.(next)
    if (!isControlled) setInternalOpen(next)
  }

  return (
    <div id={id} className="border-y border-border-warm py-6">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 font-body text-sm font-medium text-emerald transition hover:text-emerald-light"
        aria-expanded={open}
      >
        <ChevronRight
          className={`h-4 w-4 shrink-0 transition-transform duration-300 ease-in-out ${
            open ? 'rotate-90' : ''
          }`}
          strokeWidth={2}
        />
        How to choose the right products
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-6">
            <h3 className="font-display text-xl font-bold text-ink">
              Choosing the Right Products
            </h3>
            <p className="mt-4 font-body text-base text-stone">
              Start with products you genuinely like and can speak to naturally — authentic
              enthusiasm is your biggest conversion tool.
            </p>
            <div className="mt-6 space-y-5">
              {SECTIONS.map((section) => (
                <div
                  key={section.title}
                  className="border-l-2 border-emerald pl-4"
                >
                  <h4 className="font-body text-sm font-semibold text-ink">{section.title}</h4>
                  <p className="mt-2 font-body text-sm text-stone">{section.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

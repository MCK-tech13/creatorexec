import { Link } from 'react-router-dom'
import { SUPPORT_EMAIL } from '../../lib/support'

type SiteFooterVariant = 'landing' | 'app'

interface SiteFooterProps {
  variant?: SiteFooterVariant
  onResetOnboarding?: () => void
}

export function SiteFooter({ variant = 'landing', onResetOnboarding }: SiteFooterProps) {
  return (
    <footer className="border-t border-border-warm bg-white">
      <div className="mx-auto max-w-7xl space-y-4 px-5 py-6 text-center sm:px-8 sm:py-8">
        <nav
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-body text-xs text-stone sm:text-sm"
          aria-label="Legal and support"
        >
          <Link to="/privacy" className="link-elegant font-medium text-stone hover:text-ink">
            Privacy Policy
          </Link>
          <span className="text-border-warm" aria-hidden>
            ·
          </span>
          <Link to="/terms" className="link-elegant font-medium text-stone hover:text-ink">
            Terms of Service
          </Link>
          <span className="text-border-warm" aria-hidden>
            ·
          </span>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="link-elegant font-medium text-stone hover:text-ink">
            {SUPPORT_EMAIL}
          </a>
        </nav>

        {variant === 'app' && onResetOnboarding && (
          <button
            type="button"
            onClick={onResetOnboarding}
            className="link-elegant font-body text-xs uppercase tracking-[0.14em] text-stone"
          >
            Restart Sprint Setup
          </button>
        )}
      </div>
    </footer>
  )
}

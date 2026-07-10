import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useSubscription } from '../../contexts/SubscriptionContext'
import { openBillingPortal } from '../../lib/billing/api'

export function BillingBanner() {
  const { session } = useAuth()
  const { access } = useSubscription()
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)

  if (!access.showBillingBanner || !access.bannerMessage) {
    return null
  }

  async function handleManageBilling() {
    if (!session?.access_token) return
    setOpening(true)
    setError(null)
    try {
      const url = await openBillingPortal(session.access_token)
      window.location.assign(url)
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : 'Could not open billing portal.')
      setOpening(false)
    }
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-body text-sm text-amber-950">{access.bannerMessage}</p>
        <div className="flex items-center gap-3">
          {error && (
            <span className="font-body text-xs text-tier-deadline" role="alert">
              {error}
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleManageBilling()}
            disabled={opening}
            className="btn-outline shrink-0 px-3 py-2 font-body text-xs font-medium uppercase tracking-[0.08em] text-amber-950"
          >
            {opening ? 'Opening…' : 'Manage billing'}
          </button>
        </div>
      </div>
    </div>
  )
}

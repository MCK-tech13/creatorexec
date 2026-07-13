import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useSubscription } from '../../contexts/SubscriptionContext'
import { AuthLayout } from '../auth/AuthScreens'
import { openBillingPortal, startCheckoutSession } from '../../lib/billing/api'
import { isStripeTestMode } from '../../lib/billing/stripeTestMode'

export function SubscribePage() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const { canAccessApp, loading, reload, subscription } = useSubscription()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const checkoutState = searchParams.get('checkout')
  const showStripeTestHint = isStripeTestMode()

  useEffect(() => {
    if (checkoutState === 'success') {
      void reload()
    }
  }, [checkoutState, reload])

  if (!loading && canAccessApp) {
    return <Navigate to="/app" replace />
  }

  async function handleSubscribe() {
    if (!session?.access_token) {
      setError('Your session expired. Please log in again.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const url = await startCheckoutSession(session.access_token)
      window.location.assign(url)
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Could not start checkout. Is the billing API running?',
      )
      setSubmitting(false)
    }
  }

  async function handleManageBilling() {
    if (!session?.access_token) return
    setSubmitting(true)
    setError(null)
    try {
      const url = await openBillingPortal(session.access_token)
      window.location.assign(url)
    } catch (portalError) {
      setError(
        portalError instanceof Error ? portalError.message : 'Could not open billing portal.',
      )
      setSubmitting(false)
    }
  }

  async function handleSignOut() {
    const result = await signOut()
    if (!result.error) {
      navigate('/', { replace: true })
    }
  }

  return (
    <AuthLayout
      title="Subscribe to CreatorExec"
      subtitle="Lock in beta pricing while you build your TikTok Shop operating system."
      footer={
        <div className="space-y-3 text-center font-body text-sm text-stone">
          {subscription?.stripeCustomerId && (
            <button
              type="button"
              onClick={() => void handleManageBilling()}
              disabled={submitting}
              className="link-elegant font-medium text-ink"
            >
              Manage billing in Stripe
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="link-elegant block w-full font-medium text-stone"
          >
            Log out
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="border border-border-warm bg-white p-6">
          <p className="label-caps text-emerald">Beta pricing</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="font-display text-4xl font-bold text-ink">$25</span>
            <span className="pb-1 font-body text-sm text-stone">/ month</span>
          </div>
        </div>

        <ul className="space-y-2 font-body text-sm text-stone">
          <li>7-day money-back guarantee — email support@creatorexec.app within 7 days for a full refund.</li>
          <li>Cancel anytime — you keep access through the end of your paid period.</li>
          <li>No refunds after the 7-day window; future billing stops when you cancel.</li>
        </ul>

        {checkoutState === 'success' && (
          <p className="font-body text-sm text-emerald" role="status">
            Payment received. Activating your subscription…
          </p>
        )}
        {checkoutState === 'canceled' && (
          <p className="font-body text-sm text-stone" role="status">
            Checkout canceled. You can subscribe whenever you are ready.
          </p>
        )}
        {error && (
          <p className="font-body text-sm text-tier-deadline" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSubscribe()}
          disabled={submitting || loading}
          className="btn-primary w-full py-4"
        >
          {submitting ? 'Redirecting to Stripe…' : 'Subscribe with Stripe Checkout'}
        </button>

        <p className="font-body text-xs leading-relaxed text-stone">
          You will be redirected to Stripe&apos;s secure checkout page to enter payment details.
          {showStripeTestHint && (
            <> Use test card 4242 4242 4242 4242 in Stripe test mode.</>
          )}
        </p>
      </div>
    </AuthLayout>
  )
}

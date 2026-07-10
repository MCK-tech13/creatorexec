import { Navigate } from 'react-router-dom'
import { useSubscription } from '../../contexts/SubscriptionContext'
import { AuthLoadingScreen } from '../auth/AuthScreens'

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { loading, canAccessApp, error } = useSubscription()

  if (loading) {
    return <AuthLoadingScreen label="Checking your subscription…" />
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-warm px-6 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="font-display text-xl font-bold text-ink">Billing status unavailable</h1>
          <p className="font-body text-sm text-stone">{error}</p>
        </div>
      </div>
    )
  }

  if (!canAccessApp) {
    return <Navigate to="/subscribe" replace />
  }

  return children
}

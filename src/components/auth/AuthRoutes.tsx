import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { hasPasswordRecoveryInUrl } from '../../lib/auth/passwordReset'
import { AuthLoadingScreen } from './AuthScreens'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <AuthLoadingScreen label="Checking your session…" />
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

export function LandingRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <AuthLoadingScreen label="Loading…" />
  }

  // Recovery links may land on `/` when Site URL is the apex root. Do not send
  // the recovery session into subscribe/app — PasswordRecoveryRedirect + this
  // guard keep the user on the reset flow.
  if (hasPasswordRecoveryInUrl(location)) {
    return (
      <Navigate to={`/reset-password${location.search}${location.hash}`} replace />
    )
  }

  if (session) {
    return <Navigate to="/subscribe" replace />
  }

  return children
}

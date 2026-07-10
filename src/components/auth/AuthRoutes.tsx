import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
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

  if (loading) {
    return <AuthLoadingScreen label="Loading…" />
  }

  if (session) {
    return <Navigate to="/subscribe" replace />
  }

  return children
}

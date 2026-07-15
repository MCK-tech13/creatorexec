import { Outlet } from 'react-router-dom'
import { ProtectedRoute } from '../auth/AuthRoutes'
import { SubscriptionGate } from '../billing/SubscriptionGate'
import { SubscriptionProvider } from '../../contexts/SubscriptionContext'
import { UserDataProvider } from '../../contexts/UserDataContext'

/** Auth + billing + data shell for all `/app` and `/app/:section` routes. */
export function AppShellProviders() {
  return (
    <ProtectedRoute>
      <SubscriptionProvider>
        <SubscriptionGate>
          <UserDataProvider>
            <Outlet />
          </UserDataProvider>
        </SubscriptionGate>
      </SubscriptionProvider>
    </ProtectedRoute>
  )
}

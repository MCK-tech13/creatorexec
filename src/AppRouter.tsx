import { Routes, Route, Navigate } from 'react-router-dom'
import { WelcomeScreen } from './components/onboarding/WelcomeScreen'
import { LoginPage } from './components/auth/LoginPage'
import { SignUpPage } from './components/auth/SignUpPage'
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './components/auth/ResetPasswordPage'
import { LandingRoute, ProtectedRoute } from './components/auth/AuthRoutes'
import { SupabaseConfigNotice } from './components/auth/SupabaseConfigNotice'
import { SubscribePage } from './components/billing/SubscribePage'
import { SubscriptionGate } from './components/billing/SubscriptionGate'
import { SubscriptionProvider } from './contexts/SubscriptionContext'
import { UserDataProvider } from './contexts/UserDataContext'
import CreatorExecApp from './CreatorExecApp'

export function AppRouter() {
  return (
    <SupabaseConfigNotice>
      <Routes>
        <Route
          path="/"
          element={
            <LandingRoute>
              <WelcomeScreen />
            </LandingRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/subscribe"
          element={
            <ProtectedRoute>
              <SubscriptionProvider>
                <SubscribePage />
              </SubscriptionProvider>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <SubscriptionProvider>
                <SubscriptionGate>
                  <UserDataProvider>
                    <CreatorExecApp />
                  </UserDataProvider>
                </SubscriptionGate>
              </SubscriptionProvider>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SupabaseConfigNotice>
  )
}

import { Routes, Route, Navigate } from 'react-router-dom'
import { WelcomeScreen } from './components/onboarding/WelcomeScreen'
import { LoginPage } from './components/auth/LoginPage'
import { SignUpPage } from './components/auth/SignUpPage'
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './components/auth/ResetPasswordPage'
import { LandingRoute, ProtectedRoute } from './components/auth/AuthRoutes'
import { SupabaseConfigNotice } from './components/auth/SupabaseConfigNotice'
import { SubscribePage } from './components/billing/SubscribePage'
import { SubscriptionProvider } from './contexts/SubscriptionContext'
import { AppShellProviders } from './components/app/AppShellProviders'
import { PrivacyPolicyPage } from './components/legal/PrivacyPolicyPage'
import { TermsOfServicePage } from './components/legal/TermsOfServicePage'
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
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
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
        <Route path="/app" element={<AppShellProviders />}>
          <Route index element={<CreatorExecApp />} />
          <Route path=":section" element={<CreatorExecApp />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SupabaseConfigNotice>
  )
}

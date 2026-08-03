import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { AppRouter } from './AppRouter'
import { PasswordRecoveryRedirect } from './components/auth/PasswordRecoveryRedirect'
import { ClientVersionGuard } from './components/version/ClientVersionGuard'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PasswordRecoveryRedirect />
        <ClientVersionGuard />
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

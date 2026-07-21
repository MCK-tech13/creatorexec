import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { AppRouter } from './AppRouter'
import { ClientVersionGuard } from './components/version/ClientVersionGuard'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ClientVersionGuard />
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

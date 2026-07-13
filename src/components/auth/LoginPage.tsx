import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { AuthErrorAlert } from './AuthErrorAlert'
import { AuthLayout } from './AuthScreens'

export function LoginPage() {
  const { signIn, session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/app'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    return <Navigate to="/app" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const result = await signIn(email.trim(), password)
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    navigate(from, { replace: true })
  }

  return (
    <AuthLayout
      title="Log in"
      subtitle="Access your CreatorExec dashboard, sprint schedule, and deal tracking."
      footer={
        <p className="text-center font-body text-sm text-stone">
          New here?{' '}
          <Link to="/signup" className="link-elegant font-medium text-ink">
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="login-email" className="label-caps mb-2 block">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-border-warm bg-white px-4 py-3 font-body text-base text-ink"
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="login-password" className="label-caps">
              Password
            </label>
            <Link to="/forgot-password" className="link-elegant font-body text-xs text-stone">
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-border-warm bg-white px-4 py-3 font-body text-base text-ink"
          />
        </div>
        {error && <AuthErrorAlert message={error} />}
        <button type="submit" disabled={submitting} className="btn-primary w-full py-4">
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </AuthLayout>
  )
}

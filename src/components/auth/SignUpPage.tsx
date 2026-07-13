import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { AuthErrorAlert } from './AuthErrorAlert'
import { AuthLayout } from './AuthScreens'

export function SignUpPage() {
  const { signUp, session, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    return <Navigate to="/subscribe" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const result = await signUp(email.trim(), password)
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    if (result.needsEmailConfirmation) {
      setSuccess('Account created. Check your email for a confirmation link, then log in.')
      return
    }

    if (result.sessionCreated) {
      navigate('/subscribe', { replace: true })
      return
    }

    setSuccess('Account created. You can log in now.')
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Sign up with email and password to save your sprint setup and business data."
      footer={
        <p className="text-center font-body text-sm text-stone">
          Already have an account?{' '}
          <Link to="/login" className="link-elegant font-medium text-ink">
            Log in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="signup-email" className="label-caps mb-2 block">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-border-warm bg-white px-4 py-3 font-body text-base text-ink"
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="label-caps mb-2 block">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-border-warm bg-white px-4 py-3 font-body text-base text-ink"
          />
        </div>
        <div>
          <label htmlFor="signup-confirm-password" className="label-caps mb-2 block">
            Confirm password
          </label>
          <input
            id="signup-confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border border-border-warm bg-white px-4 py-3 font-body text-base text-ink"
          />
        </div>
        {error && <AuthErrorAlert message={error} />}
        {success && (
          <p className="font-body text-sm text-emerald" role="status">
            {success}
          </p>
        )}
        <button type="submit" disabled={submitting} className="btn-primary w-full py-4">
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
    </AuthLayout>
  )
}

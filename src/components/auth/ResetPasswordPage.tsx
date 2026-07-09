import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getSupabaseClient } from '../../lib/supabase/client'
import { AuthLayout, AuthLoadingScreen } from './AuthScreens'

export function ResetPasswordPage() {
  const { updatePassword, session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [recoveryReady, setRecoveryReady] = useState(false)

  useEffect(() => {
    const supabase = getSupabaseClient()
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY' || nextSession) {
        setRecoveryReady(true)
      }
    })

    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (sessionData.session) {
        setRecoveryReady(true)
      }
    })

    return () => data.subscription.unsubscribe()
  }, [])

  if (loading) {
    return <AuthLoadingScreen label="Preparing password reset…" />
  }

  if (!loading && !recoveryReady && !session) {
    return <Navigate to="/forgot-password" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const result = await updatePassword(password)
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    navigate('/app', { replace: true })
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Enter a new password for your CreatorExec account."
      footer={
        <p className="text-center font-body text-sm text-stone">
          <Link to="/login" className="link-elegant font-medium text-ink">
            Back to log in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="reset-password" className="label-caps mb-2 block">
            New password
          </label>
          <input
            id="reset-password"
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
          <label htmlFor="reset-confirm-password" className="label-caps mb-2 block">
            Confirm new password
          </label>
          <input
            id="reset-confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border border-border-warm bg-white px-4 py-3 font-body text-base text-ink"
          />
        </div>
        {error && (
          <p className="font-body text-sm text-tier-deadline" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting} className="btn-primary w-full py-4">
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  )
}

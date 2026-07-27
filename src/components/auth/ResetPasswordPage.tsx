import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { hasPasswordRecoveryInUrl } from '../../lib/auth/passwordReset'
import { getSupabaseClient } from '../../lib/supabase/client'
import { AuthLayout, AuthLoadingScreen } from './AuthScreens'

export function ResetPasswordPage() {
  const { updatePassword, signOut, session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [updated, setUpdated] = useState(false)
  const urlLooksLikeRecovery =
    typeof window !== 'undefined' && hasPasswordRecoveryInUrl(window.location)

  useEffect(() => {
    const supabase = getSupabaseClient()
    let cancelled = false

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY' || nextSession) {
        setRecoveryReady(true)
      }
    })

    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (cancelled) return
      if (sessionData.session) {
        setRecoveryReady(true)
      }
      // Allow detectSessionInUrl a beat to exchange hash/query tokens before we
      // decide the link is invalid and bounce to forgot-password.
      window.setTimeout(() => {
        if (!cancelled) setBootstrapped(true)
      }, urlLooksLikeRecovery ? 1200 : 0)
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [urlLooksLikeRecovery])

  if (loading || (!bootstrapped && urlLooksLikeRecovery)) {
    return <AuthLoadingScreen label="Preparing password reset…" />
  }

  if (bootstrapped && !recoveryReady && !session) {
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
    if (result.error) {
      setSubmitting(false)
      setError(result.error)
      return
    }

    setUpdated(true)
    await signOut()
    setSubmitting(false)
    navigate('/login', { replace: true, state: { passwordReset: true } })
  }

  if (updated) {
    return <AuthLoadingScreen label="Password updated. Taking you to log in…" />
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

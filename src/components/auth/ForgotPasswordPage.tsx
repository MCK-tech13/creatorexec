import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { AuthErrorAlert } from './AuthErrorAlert'
import { AuthLayout } from './AuthScreens'

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    const result = await resetPassword(email.trim())
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setSuccess('If an account exists for that email, a password reset link is on its way.')
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your account email and we will send a link to choose a new password."
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
          <label htmlFor="forgot-email" className="label-caps mb-2 block">
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthLayout>
  )
}

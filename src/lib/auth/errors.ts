/** Map Supabase Auth errors to user-facing copy. */
export function mapAuthErrorMessage(error: unknown, fallback: string): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : ''

  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Email or password is incorrect. Please try again.'
  }
  if (normalized.includes('user already registered')) {
    return 'An account with this email already exists. Try logging in instead.'
  }
  if (normalized.includes('password should be at least')) {
    return 'Password must be at least 6 characters.'
  }
  if (normalized.includes('unable to validate email address') || normalized.includes('invalid email')) {
    return 'Please enter a valid email address.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email before logging in. Check your inbox for the confirmation link.'
  }
  if (normalized.includes('signup is disabled')) {
    return 'Sign up is temporarily unavailable. Please try again later.'
  }
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  if (normalized.includes('same as the old password')) {
    return 'Choose a new password that is different from your current one.'
  }
  if (normalized.includes('session missing') || normalized.includes('jwt')) {
    return 'Your reset link has expired or is invalid. Request a new password reset email.'
  }

  return message || fallback
}

/** Password-reset helpers for Supabase Auth recovery links. */

/** Apex path currently allowlisted in Supabase Auth URL config. */
export const PRODUCTION_PASSWORD_RESET_REDIRECT =
  'https://creatorexec.app/reset-password'

/**
 * Redirect used by `resetPasswordForEmail`.
 *
 * Production traffic is on www (apex 308s there), but Supabase today allowlists
 * the apex `/reset-password` URL — not www. Requesting www causes GoTrue to
 * fall back to Site URL (`https://creatorexec.app`) with no path, so users land
 * on the marketing home instead of the reset form.
 *
 * Always request the allowlisted apex path in production; Vercel then 308s to
 * www and browsers keep the `#access_token&type=recovery` hash.
 */
export function getPasswordResetRedirectTo(
  origin = typeof window !== 'undefined' ? window.location.origin : '',
): string {
  const normalized = origin.replace(/\/$/, '')
  if (
    normalized === 'https://www.creatorexec.app' ||
    normalized === 'https://creatorexec.app'
  ) {
    return PRODUCTION_PASSWORD_RESET_REDIRECT
  }
  return `${normalized}/reset-password`
}

/** True when the current URL carries a Supabase recovery session (hash or query). */
export function hasPasswordRecoveryInUrl(
  location: Pick<Location, 'hash' | 'search'> = typeof window !== 'undefined'
    ? window.location
    : { hash: '', search: '' },
): boolean {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
  const hashParams = new URLSearchParams(hash)
  if (hashParams.get('type') === 'recovery') return true
  if (hashParams.get('error_code') === 'otp_expired' && hash.includes('recovery')) {
    return true
  }

  const query = new URLSearchParams(location.search)
  if (query.get('type') === 'recovery') return true

  return false
}

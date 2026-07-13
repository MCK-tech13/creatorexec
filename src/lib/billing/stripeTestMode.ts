/**
 * Whether to show Stripe test-mode UI (e.g. test card hint).
 * Stripe price IDs are not prefixed by mode; prefer an explicit flag or publishable key.
 */
export function isStripeTestMode(): boolean {
  if (import.meta.env.VITE_STRIPE_TEST_MODE === 'true') {
    return true
  }

  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (typeof publishableKey === 'string' && publishableKey.length > 0) {
    if (publishableKey.startsWith('pk_test_')) return true
    if (publishableKey.startsWith('pk_live_')) return false
  }

  return import.meta.env.DEV
}

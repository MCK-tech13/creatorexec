/**
 * Stripe webhook signature verification.
 *
 * Test-mode and live-mode Dashboard endpoints have different `whsec_…` secrets.
 * Production Vercel typically stores the live secret as STRIPE_WEBHOOK_SECRET.
 * If the test-mode endpoint also posts to the same URL, verification must try
 * STRIPE_WEBHOOK_SECRET_TEST as well — otherwise Stripe sees HTTP 400
 * "No signatures found matching the expected signature".
 */

/**
 * @param {{ stripeWebhookSecret?: string | null, stripeWebhookSecretTest?: string | null }} env
 * @returns {string[]}
 */
export function listWebhookSecrets(env) {
  const secrets = []
  const seen = new Set()
  for (const value of [env.stripeWebhookSecret, env.stripeWebhookSecretTest]) {
    const secret = typeof value === 'string' ? value.trim() : ''
    if (!secret || seen.has(secret)) continue
    seen.add(secret)
    secrets.push(secret)
  }
  return secrets
}

/**
 * @param {import('stripe').default} stripe
 * @param {Buffer | string} body
 * @param {string} signature
 * @param {string[]} secrets
 * @returns {{ event: import('stripe').Stripe.Event, secretIndex: number }}
 */
export function constructEventWithSecrets(stripe, body, signature, secrets) {
  if (!secrets.length) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
  }

  let lastError = null
  for (let secretIndex = 0; secretIndex < secrets.length; secretIndex += 1) {
    try {
      const event = stripe.webhooks.constructEvent(body, signature, secrets[secretIndex])
      return { event, secretIndex }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('invalid webhook signature')
}

/**
 * Live Stripe API keys cannot retrieve test-mode objects, and test customer IDs
 * must not be written into production `user_subscriptions`.
 *
 * @param {boolean} livemode
 * @param {string | null | undefined} stripeSecretKey
 */
export function shouldProcessWebhookEvent(livemode, stripeSecretKey) {
  if (livemode) return true
  if (typeof stripeSecretKey === 'string' && stripeSecretKey.startsWith('sk_live_')) {
    return false
  }
  return true
}

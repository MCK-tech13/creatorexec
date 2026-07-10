const STRIPE_STATUSES = new Set([
  'none',
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
])

export function mapStripeSubscriptionStatus(status) {
  if (!status) return 'none'
  return STRIPE_STATUSES.has(status) ? status : 'none'
}

/**
 * Stripe API 2025-03-31 (Basil) moved billing periods to subscription items.
 * Read from items first; fall back to top-level for older API/webhook versions.
 */
export function getSubscriptionPeriodEnd(subscription) {
  if (!subscription) return null

  const itemPeriodEnds = (subscription.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((value) => typeof value === 'number' && value > 0)

  if (itemPeriodEnds.length > 0) {
    return Math.max(...itemPeriodEnds)
  }

  if (typeof subscription.current_period_end === 'number' && subscription.current_period_end > 0) {
    return subscription.current_period_end
  }

  return null
}

export function subscriptionRowFromStripe({
  userId,
  customerId,
  subscription,
  priceId = null,
}) {
  const status = subscription ? mapStripeSubscriptionStatus(subscription.status) : 'none'
  const periodEndUnix = getSubscriptionPeriodEnd(subscription)

  return {
    user_id: userId,
    stripe_customer_id: customerId ?? null,
    stripe_subscription_id: subscription?.id ?? null,
    subscription_status: status,
    price_id: priceId ?? subscription?.items?.data?.[0]?.price?.id ?? null,
    current_period_end: periodEndUnix
      ? new Date(periodEndUnix * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
  }
}

export async function upsertUserSubscription(admin, row) {
  const { data, error } = await admin
    .from('user_subscriptions')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to upsert user_subscriptions: ${error.message}`)
  }

  return data
}

export async function findUserIdByStripeCustomer(admin, customerId) {
  const { data, error } = await admin
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to look up user by Stripe customer: ${error.message}`)
  }

  return data?.user_id ?? null
}

export async function syncSubscriptionForUser(admin, userId, customerId, subscription) {
  return upsertUserSubscription(
    admin,
    subscriptionRowFromStripe({ userId, customerId, subscription }),
  )
}

async function retrieveSubscription(stripe, subscriptionId) {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  })
}

async function resolveSubscription(stripe, subscription) {
  if (!subscription) return null
  if (getSubscriptionPeriodEnd(subscription)) return subscription
  if (!subscription.id) return subscription
  return retrieveSubscription(stripe, subscription.id)
}

export async function syncCheckoutSessionCompleted(admin, stripe, session) {
  const userId = session.metadata?.user_id ?? session.client_reference_id
  if (!userId) {
    throw new Error('Checkout session missing user_id metadata')
  }

  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null

  let subscription = null
  if (session.subscription) {
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription.id
    subscription = await retrieveSubscription(stripe, subscriptionId)
  }

  return upsertUserSubscription(
    admin,
    subscriptionRowFromStripe({
      userId,
      customerId,
      subscription,
      priceId: session.metadata?.price_id ?? null,
    }),
  )
}

export async function syncStripeSubscriptionEvent(admin, stripe, subscription, eventType) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id

  let userId = subscription.metadata?.user_id ?? null
  if (!userId && customerId) {
    userId = await findUserIdByStripeCustomer(admin, customerId)
  }

  if (!userId && customerId) {
    const customer = await stripe.customers.retrieve(customerId)
    if (!customer.deleted) {
      userId = customer.metadata?.user_id ?? null
    }
  }

  if (!userId) {
    throw new Error(`Could not resolve user for subscription event (${eventType})`)
  }

  if (eventType === 'customer.subscription.deleted') {
    const resolved = await resolveSubscription(stripe, subscription)
    return upsertUserSubscription(
      admin,
      subscriptionRowFromStripe({
        userId,
        customerId,
        subscription: { ...resolved, status: 'canceled' },
      }),
    )
  }

  const resolved = await resolveSubscription(stripe, subscription)
  return syncSubscriptionForUser(admin, userId, customerId, resolved)
}

export async function markSubscriptionPastDue(admin, stripe, invoice) {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!customerId) return null

  let userId = invoice.metadata?.user_id ?? null
  if (!userId) {
    userId = await findUserIdByStripeCustomer(admin, customerId)
  }

  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id

  let subscription = null
  if (subscriptionId) {
    subscription = await retrieveSubscription(stripe, subscriptionId)
  }

  if (!userId) {
    throw new Error('Could not resolve user for invoice.payment_failed')
  }

  return upsertUserSubscription(
    admin,
    subscriptionRowFromStripe({
      userId,
      customerId,
      subscription: subscription
        ? { ...subscription, status: 'past_due' }
        : { status: 'past_due' },
    }),
  )
}

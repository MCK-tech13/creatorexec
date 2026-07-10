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

function invoicePeriodEnd(invoice) {
  if (!invoice || typeof invoice !== 'object') return null
  if (typeof invoice.period_end === 'number' && invoice.period_end > 0) {
    return invoice.period_end
  }
  const linePeriodEnd = invoice.lines?.data?.[0]?.period?.end
  if (typeof linePeriodEnd === 'number' && linePeriodEnd > 0) {
    return linePeriodEnd
  }
  return null
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

  const latestInvoice =
    subscription.latest_invoice && typeof subscription.latest_invoice === 'object'
      ? subscription.latest_invoice
      : null

  return invoicePeriodEnd(latestInvoice)
}

export function logPeriodEndProbe(label, subscription, extra = {}) {
  const items = subscription?.items?.data ?? []
  const latestInvoice =
    subscription?.latest_invoice && typeof subscription.latest_invoice === 'object'
      ? subscription.latest_invoice
      : null

  console.log(
    `[billing-api] period-probe:${label}`,
    JSON.stringify({
      subscriptionId: subscription?.id ?? null,
      topLevelPeriodEnd: subscription?.current_period_end ?? null,
      itemPeriodEnds: items.map((item) => ({
        id: item.id,
        current_period_end: item.current_period_end ?? null,
      })),
      latestInvoiceId:
        typeof subscription?.latest_invoice === 'string'
          ? subscription.latest_invoice
          : latestInvoice?.id ?? null,
      latestInvoicePeriodEnd: latestInvoice?.period_end ?? null,
      invoicePeriodEnd: extra.invoice?.period_end ?? null,
      resolvedFromObject: getSubscriptionPeriodEnd(subscription),
      ...extra,
    }),
  )
}

export async function resolvePeriodEndUnix(stripe, subscription, context = 'unknown') {
  if (!subscription) return null

  logPeriodEndProbe(`${context}:initial`, subscription)

  let periodEnd = getSubscriptionPeriodEnd(subscription)
  if (periodEnd) {
    console.log(`[billing-api] period-probe:${context} using subscription object → ${periodEnd}`)
    return periodEnd
  }

  if (!subscription.id) {
    console.warn(`[billing-api] period-probe:${context} no subscription id to retrieve`)
    return null
  }

  const full = await stripe.subscriptions.retrieve(subscription.id, {
    expand: ['items.data.price', 'latest_invoice'],
  })
  logPeriodEndProbe(`${context}:after-retrieve`, full)

  periodEnd = getSubscriptionPeriodEnd(full)
  if (periodEnd) {
    console.log(`[billing-api] period-probe:${context} using retrieved subscription → ${periodEnd}`)
    return periodEnd
  }

  const invoices = await stripe.invoices.list({
    subscription: subscription.id,
    limit: 1,
  })
  const listedInvoice = invoices.data[0] ?? null
  if (listedInvoice) {
    logPeriodEndProbe(`${context}:invoice-list`, full, { invoice: listedInvoice })
    periodEnd = invoicePeriodEnd(listedInvoice)
    if (periodEnd) {
      console.log(`[billing-api] period-probe:${context} using invoice.list → ${periodEnd}`)
      return periodEnd
    }
  }

  console.warn(
    `[billing-api] period-probe:${context} unresolved for ${subscription.id} — check Stripe Dashboard subscription + invoice`,
  )
  return null
}

export function subscriptionRowFromStripe({
  userId,
  customerId,
  subscription,
  priceId = null,
  periodEndUnix = null,
}) {
  const status = subscription ? mapStripeSubscriptionStatus(subscription.status) : 'none'
  const resolvedPeriodEnd = periodEndUnix ?? getSubscriptionPeriodEnd(subscription)

  return {
    user_id: userId,
    stripe_customer_id: customerId ?? null,
    stripe_subscription_id: subscription?.id ?? null,
    subscription_status: status,
    price_id: priceId ?? subscription?.items?.data?.[0]?.price?.id ?? null,
    current_period_end: resolvedPeriodEnd
      ? new Date(resolvedPeriodEnd * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
  }
}

export async function upsertUserSubscription(admin, row) {
  if (!row.current_period_end && row.user_id) {
    const { data: existing, error: existingError } = await admin
      .from('user_subscriptions')
      .select('current_period_end')
      .eq('user_id', row.user_id)
      .maybeSingle()

    if (existingError) {
      throw new Error(`Failed to read existing user_subscriptions: ${existingError.message}`)
    }

    if (existing?.current_period_end) {
      row = { ...row, current_period_end: existing.current_period_end }
      console.log(
        `[billing-api] preserved existing current_period_end for user ${row.user_id}: ${existing.current_period_end}`,
      )
    }
  }

  const { data, error } = await admin
    .from('user_subscriptions')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to upsert user_subscriptions: ${error.message}`)
  }

  console.log(
    '[billing-api] upserted user_subscriptions',
    JSON.stringify({
      user_id: data.user_id,
      subscription_status: data.subscription_status,
      stripe_subscription_id: data.stripe_subscription_id,
      current_period_end: data.current_period_end,
      cancel_at_period_end: data.cancel_at_period_end,
    }),
  )

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

async function resolveUserIdForSubscription(admin, stripe, subscription, invoice = null) {
  const customerId =
    typeof subscription?.customer === 'string'
      ? subscription.customer
      : subscription?.customer?.id ??
        (typeof invoice?.customer === 'string' ? invoice.customer : invoice?.customer?.id)

  let userId = subscription?.metadata?.user_id ?? invoice?.metadata?.user_id ?? null
  if (!userId && customerId) {
    userId = await findUserIdByStripeCustomer(admin, customerId)
  }

  if (!userId && customerId) {
    const customer = await stripe.customers.retrieve(customerId)
    if (!customer.deleted) {
      userId = customer.metadata?.user_id ?? null
    }
  }

  return { userId, customerId: customerId ?? null }
}

async function retrieveSubscription(stripe, subscriptionId) {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price', 'latest_invoice'],
  })
}

export async function syncSubscriptionForUser(
  admin,
  stripe,
  userId,
  customerId,
  subscription,
  context,
) {
  const periodEndUnix = await resolvePeriodEndUnix(stripe, subscription, context)
  return upsertUserSubscription(
    admin,
    subscriptionRowFromStripe({
      userId,
      customerId,
      subscription,
      periodEndUnix,
    }),
  )
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

  logPeriodEndProbe('checkout.session.completed', subscription, {
    sessionId: session.id,
    userId,
  })

  const periodEndUnix = subscription
    ? await resolvePeriodEndUnix(stripe, subscription, 'checkout.session.completed')
    : null

  return upsertUserSubscription(
    admin,
    subscriptionRowFromStripe({
      userId,
      customerId,
      subscription,
      priceId: session.metadata?.price_id ?? null,
      periodEndUnix,
    }),
  )
}

export async function syncStripeSubscriptionEvent(admin, stripe, subscription, eventType) {
  const { userId, customerId } = await resolveUserIdForSubscription(admin, stripe, subscription)
  if (!userId) {
    throw new Error(`Could not resolve user for subscription event (${eventType})`)
  }

  logPeriodEndProbe(eventType, subscription, { userId })

  if (eventType === 'customer.subscription.deleted') {
    const full = subscription.id ? await retrieveSubscription(stripe, subscription.id) : subscription
    const periodEndUnix = await resolvePeriodEndUnix(stripe, full, eventType)
    return upsertUserSubscription(
      admin,
      subscriptionRowFromStripe({
        userId,
        customerId,
        subscription: { ...full, status: 'canceled' },
        periodEndUnix,
      }),
    )
  }

  return syncSubscriptionForUser(admin, stripe, userId, customerId, subscription, eventType)
}

export async function syncInvoicePeriod(admin, stripe, invoice, context) {
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
  if (!subscriptionId) {
    console.log(`[billing-api] ${context} skipped — invoice has no subscription`)
    return null
  }

  const subscription = await retrieveSubscription(stripe, subscriptionId)
  const { userId, customerId } = await resolveUserIdForSubscription(
    admin,
    stripe,
    subscription,
    invoice,
  )

  if (!userId) {
    throw new Error(`Could not resolve user for ${context}`)
  }

  logPeriodEndProbe(context, subscription, { invoice, userId })

  const periodEndUnix =
    invoicePeriodEnd(invoice) ??
    (await resolvePeriodEndUnix(stripe, subscription, context))

  return upsertUserSubscription(
    admin,
    subscriptionRowFromStripe({
      userId,
      customerId,
      subscription,
      periodEndUnix,
    }),
  )
}

export async function markSubscriptionPastDue(admin, stripe, invoice) {
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id

  let subscription = null
  if (subscriptionId) {
    subscription = await retrieveSubscription(stripe, subscriptionId)
  }

  const { userId, customerId } = await resolveUserIdForSubscription(
    admin,
    stripe,
    subscription,
    invoice,
  )

  if (!userId) {
    throw new Error('Could not resolve user for invoice.payment_failed')
  }

  const periodEndUnix = subscription
    ? (invoicePeriodEnd(invoice) ??
      (await resolvePeriodEndUnix(stripe, subscription, 'invoice.payment_failed')))
    : null

  return upsertUserSubscription(
    admin,
    subscriptionRowFromStripe({
      userId,
      customerId,
      subscription: subscription
        ? { ...subscription, status: 'past_due' }
        : { status: 'past_due' },
      periodEndUnix,
    }),
  )
}

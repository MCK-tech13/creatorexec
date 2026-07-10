/**
 * Stripe billing verification (test mode only).
 * Usage: npm run test:stripe
 */
import Stripe from 'stripe'
import { loadEnvFile, assertBillingEnv } from '../server/env.mjs'
import { getSupabaseAdmin } from '../server/supabaseAdmin.mjs'
import {
  getSubscriptionPeriodEnd,
  markSubscriptionPastDue,
  syncCheckoutSessionCompleted,
  syncInvoicePeriod,
  syncStripeSubscriptionEvent,
} from '../server/subscriptionSync.mjs'

loadEnvFile()

function assertPeriodEndMapping() {
  const basilShape = {
    id: 'sub_basil',
    status: 'active',
    items: { data: [{ current_period_end: 1_712_678_400 }] },
  }
  const legacyShape = {
    id: 'sub_legacy',
    status: 'active',
    current_period_end: 1_712_678_400,
  }
  const invoiceShape = {
    id: 'sub_invoice',
    status: 'active',
    items: { data: [] },
    latest_invoice: { period_end: 1_712_678_400 },
  }

  if (getSubscriptionPeriodEnd(basilShape) !== 1_712_678_400) {
    throw new Error('Basil API period-end mapping failed')
  }
  if (getSubscriptionPeriodEnd(legacyShape) !== 1_712_678_400) {
    throw new Error('Legacy API period-end mapping failed')
  }
  if (getSubscriptionPeriodEnd(invoiceShape) !== 1_712_678_400) {
    throw new Error('Invoice fallback period-end mapping failed')
  }
  console.log('PASS: current_period_end mapping (Basil + legacy + invoice shapes)')
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10)
}

async function createTestUser(admin, label) {
  const email = `creatorexec-stripe-${label}-${randomSuffix()}@example.com`
  const password = `Stripe-${randomSuffix()}-Pass1!`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    throw new Error(`Failed to create ${label} user: ${error?.message ?? 'unknown'}`)
  }
  return { id: data.user.id, email, password }
}

async function attachTestPaymentMethod(stripe, customerId) {
  const paymentMethod = await stripe.paymentMethods.create({
    type: 'card',
    card: { token: 'tok_visa' },
  })
  await stripe.paymentMethods.attach(paymentMethod.id, { customer: customerId })
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethod.id },
  })
  return paymentMethod.id
}

async function dumpSubscription(admin, userId, label) {
  const { data, error } = await admin
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error

  console.log(`\n--- user_subscriptions (${label}) ---`)
  console.log(JSON.stringify(data, null, 2))
  return data
}

async function main() {
  assertPeriodEndMapping()

  const env = assertBillingEnv()
  const stripe = new Stripe(env.stripeSecretKey)
  const admin = getSupabaseAdmin(env.supabaseUrl, env.supabaseServiceRoleKey)

  const user = await createTestUser(admin, 'billing')
  console.log('Stripe billing verification (test mode)')
  console.log('='.repeat(60))
  console.log(`Test user: ${user.email} (${user.id})`)

  try {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    })

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      client_reference_id: user.id,
      line_items: [{ price: env.stripeBetaPriceId, quantity: 1 }],
      success_url: `${env.appUrl}/subscribe?checkout=success`,
      cancel_url: `${env.appUrl}/subscribe?checkout=canceled`,
      metadata: { user_id: user.id, price_id: env.stripeBetaPriceId },
    })

    if (!checkoutSession.url) {
      throw new Error('Checkout session missing URL')
    }
    console.log('\n[1/5] PASS: Stripe Checkout session created')
    console.log(`checkout_session_id: ${checkoutSession.id}`)

    const paymentMethodId = await attachTestPaymentMethod(stripe, customer.id)
    const createdSubscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: env.stripeBetaPriceId }],
      default_payment_method: paymentMethodId,
      metadata: { user_id: user.id, price_id: env.stripeBetaPriceId },
    })
    const subscription = await stripe.subscriptions.retrieve(createdSubscription.id, {
      expand: ['items.data.price', 'latest_invoice'],
    })

    await syncCheckoutSessionCompleted(admin, stripe, {
      id: checkoutSession.id,
      customer: customer.id,
      subscription: subscription.id,
      metadata: { user_id: user.id, price_id: env.stripeBetaPriceId },
      client_reference_id: user.id,
    })

    const afterCheckout = await dumpSubscription(admin, user.id, 'after checkout sync')
    if (afterCheckout?.subscription_status !== 'active') {
      throw new Error(`Expected active after checkout, got ${afterCheckout?.subscription_status}`)
    }
    if (!afterCheckout?.current_period_end) {
      throw new Error('Expected current_period_end to be set after checkout sync')
    }
    console.log('[2/5] PASS: checkout.session.completed → active with current_period_end')
    console.log(`current_period_end: ${afterCheckout.current_period_end}`)

    const invoices = await stripe.invoices.list({ subscription: subscription.id, limit: 1 })
    const invoice = invoices.data[0]
    if (!invoice) {
      throw new Error('Expected at least one invoice for test subscription')
    }
    await syncInvoicePeriod(admin, stripe, invoice, 'invoice.paid')

    const afterInvoice = await dumpSubscription(admin, user.id, 'after invoice.paid sync')
    if (!afterInvoice?.current_period_end) {
      throw new Error('Expected current_period_end after invoice.paid sync')
    }
    console.log('[3/5] PASS: invoice.paid → current_period_end set')
    console.log(`current_period_end: ${afterInvoice.current_period_end}`)

    const canceled = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    })
    await syncStripeSubscriptionEvent(admin, stripe, canceled, 'customer.subscription.updated')

    const afterCancel = await dumpSubscription(admin, user.id, 'after cancel_at_period_end')
    if (!afterCancel?.cancel_at_period_end) {
      throw new Error('Expected cancel_at_period_end=true')
    }
    if (!afterCancel?.current_period_end) {
      throw new Error('Expected current_period_end to remain set after cancel_at_period_end')
    }
    console.log('[4/5] PASS: subscription updated with cancel_at_period_end')

    await markSubscriptionPastDue(admin, stripe, {
      customer: customer.id,
      subscription: subscription.id,
      metadata: { user_id: user.id },
      period_end: invoice.period_end,
    })

    const afterFailed = await dumpSubscription(admin, user.id, 'after invoice.payment_failed')
    if (afterFailed?.subscription_status !== 'past_due') {
      throw new Error(`Expected past_due after payment_failed, got ${afterFailed?.subscription_status}`)
    }
    if (!afterFailed?.current_period_end) {
      throw new Error('Expected current_period_end to remain set after payment_failed')
    }
    console.log('[5/5] PASS: invoice.payment_failed → past_due with current_period_end preserved')

    console.log('\n' + '='.repeat(60))
    console.log('All Stripe billing tests passed (test mode).')
  } finally {
    await admin.auth.admin.deleteUser(user.id)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

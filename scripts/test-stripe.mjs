/**
 * Stripe billing verification (test mode only).
 * Usage: npm run test:stripe
 */
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { loadEnvFile, assertBillingEnv } from '../server/env.mjs'
import { getSupabaseAdmin } from '../server/supabaseAdmin.mjs'
import {
  markSubscriptionPastDue,
  syncCheckoutSessionCompleted,
  syncStripeSubscriptionEvent,
} from '../server/subscriptionSync.mjs'

loadEnvFile()

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
  const env = assertBillingEnv()
  const stripe = new Stripe(env.stripeSecretKey)
  const admin = getSupabaseAdmin(env.supabaseUrl, env.supabaseServiceRoleKey)

  const user = await createTestUser(admin, 'billing')
  console.log('Stripe billing verification (test mode)')
  console.log('='.repeat(60))
  console.log(`Test user: ${user.email} (${user.id})`)

  try {
    // 1) Checkout session can be created
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
    console.log('\n[1/4] PASS: Stripe Checkout session created')
    console.log(`checkout_session_id: ${checkoutSession.id}`)

    // 2) Simulate checkout.session.completed webhook
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: env.stripeBetaPriceId }],
      metadata: { user_id: user.id, price_id: env.stripeBetaPriceId },
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
    console.log('[2/4] PASS: checkout.session.completed → subscription_status active')

    // 3) Cancellation
    const canceled = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    })
    await syncStripeSubscriptionEvent(admin, stripe, canceled, 'customer.subscription.updated')

    const afterCancel = await dumpSubscription(admin, user.id, 'after cancel_at_period_end')
    if (!afterCancel?.cancel_at_period_end) {
      throw new Error('Expected cancel_at_period_end=true')
    }
    console.log('[3/4] PASS: subscription updated with cancel_at_period_end')

    // 4) Failed payment
    await markSubscriptionPastDue(admin, stripe, {
      customer: customer.id,
      subscription: subscription.id,
      metadata: { user_id: user.id },
    })

    const afterFailed = await dumpSubscription(admin, user.id, 'after invoice.payment_failed')
    if (afterFailed?.subscription_status !== 'past_due') {
      throw new Error(`Expected past_due after payment_failed, got ${afterFailed?.subscription_status}`)
    }
    console.log('[4/4] PASS: invoice.payment_failed → subscription_status past_due')

    const events = await stripe.events.list({ limit: 5 })
    console.log('\n--- Recent Stripe test events (dashboard → Developers → Events) ---')
    console.log(
      JSON.stringify(
        events.data.map((event) => ({ id: event.id, type: event.type, created: event.created })),
        null,
        2,
      ),
    )

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

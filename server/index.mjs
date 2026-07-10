import express from 'express'
import Stripe from 'stripe'
import { assertBillingEnv, getWebhookEnvStatus, loadEnvFile, logServerStartup } from './env.mjs'
import { getSupabaseAdmin, verifySupabaseAccessToken } from './supabaseAdmin.mjs'
import {
  markSubscriptionPastDue,
  syncCheckoutSessionCompleted,
  syncInvoicePeriod,
  syncStripeSubscriptionEvent,
  upsertUserSubscription,
} from './subscriptionSync.mjs'

const envFileResult = loadEnvFile()
const env = assertBillingEnv()
const stripe = new Stripe(env.stripeSecretKey)
const admin = getSupabaseAdmin(env.supabaseUrl, env.supabaseServiceRoleKey)

const app = express()

/** Stripe sends application/json; charset=utf-8 — match any JSON content-type. */
function stripeWebhookBodyParser(req, res, buf) {
  if (buf?.length) {
    req.rawBody = buf
  }
}

app.get('/api/health', (_req, res) => {
  const webhook = getWebhookEnvStatus(env)
  res.json({
    ok: true,
    webhook: {
      configured: webhook.configured,
      prefix: webhook.prefix,
      looksLikeCliSecret: webhook.looksLikeCliSecret,
    },
  })
})

app.post('/api/stripe/create-checkout-session', express.json(), async (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      res.status(401).json({ error: 'Missing authorization token' })
      return
    }

    const user = await verifySupabaseAccessToken(env.supabaseUrl, env.supabaseAnonKey, token)

    const { data: existing } = await admin
      .from('user_subscriptions')
      .select('stripe_customer_id, subscription_status, current_period_end, cancel_at_period_end')
      .eq('user_id', user.id)
      .maybeSingle()

    if (
      existing &&
      ['active', 'trialing', 'past_due'].includes(existing.subscription_status)
    ) {
      res.status(400).json({ error: 'You already have an active subscription.' })
      return
    }

    let customerId = existing?.stripe_customer_id ?? null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      })
      customerId = customer.id
      await upsertUserSubscription(admin, {
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: null,
        subscription_status: 'none',
        price_id: null,
        current_period_end: null,
        cancel_at_period_end: false,
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: env.stripeBetaPriceId, quantity: 1 }],
      success_url: `${env.appUrl}/subscribe?checkout=success`,
      cancel_url: `${env.appUrl}/subscribe?checkout=canceled`,
      allow_promotion_codes: false,
      billing_address_collection: 'auto',
      metadata: {
        user_id: user.id,
        price_id: env.stripeBetaPriceId,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          price_id: env.stripeBetaPriceId,
        },
      },
      custom_text: {
        submit: {
          message:
            'Beta pricing: $25/month while beta lasts (standard price $49/month after beta). 7-day money-back guarantee — contact support within 7 days for a full refund. Cancel anytime to stop future billing.',
        },
      },
    })

    if (!session.url) {
      res.status(500).json({ error: 'Stripe did not return a checkout URL' })
      return
    }

    res.json({ url: session.url })
  } catch (error) {
    console.error('[billing-api] create-checkout-session failed', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not start checkout',
    })
  }
})

app.post('/api/stripe/create-portal-session', express.json(), async (req, res) => {
  try {
    const authHeader = req.headers.authorization ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      res.status(401).json({ error: 'Missing authorization token' })
      return
    }

    const user = await verifySupabaseAccessToken(env.supabaseUrl, env.supabaseAnonKey, token)

    const { data: existing, error } = await admin
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    if (!existing?.stripe_customer_id) {
      res.status(400).json({ error: 'No billing account found. Subscribe first.' })
      return
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: existing.stripe_customer_id,
      return_url: `${env.appUrl}/app`,
    })

    res.json({ url: portalSession.url })
  } catch (error) {
    console.error('[billing-api] create-portal-session failed', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not open billing portal',
    })
  }
})

app.post(
  '/api/stripe/webhook',
  express.raw({
    type: (req) => Boolean(req.headers['content-type']?.includes('application/json')),
    verify: stripeWebhookBodyParser,
  }),
  async (req, res) => {
    const requestId = crypto.randomUUID().slice(0, 8)
    const body = req.rawBody ?? req.body
    const bodyByteLength = Buffer.isBuffer(body) ? body.length : 0

    console.log(
      `[billing-api] webhook:${requestId} incoming type=${req.headers['content-type'] ?? 'none'} bytes=${bodyByteLength}`,
    )

    try {
      if (!env.stripeWebhookSecret) {
        console.error(
          `[billing-api] webhook:${requestId} STRIPE_WEBHOOK_SECRET is not configured — returning 500`,
        )
        res.status(500).send('STRIPE_WEBHOOK_SECRET is not configured')
        return
      }

      const signature = req.headers['stripe-signature']
      if (!signature) {
        console.error(`[billing-api] webhook:${requestId} missing stripe-signature header`)
        res.status(400).send('Missing stripe-signature header')
        return
      }

      if (!Buffer.isBuffer(body) || bodyByteLength === 0) {
        console.error(
          `[billing-api] webhook:${requestId} empty or unparsed body — check Content-Type and express.raw middleware`,
        )
        res.status(400).send('Webhook body was not parsed as raw JSON')
        return
      }

      let event
      try {
        event = stripe.webhooks.constructEvent(body, signature, env.stripeWebhookSecret)
      } catch (error) {
        console.error(`[billing-api] webhook:${requestId} signature verification failed`, error)
        res.status(400).send(`Webhook Error: ${error instanceof Error ? error.message : 'invalid'}`)
        return
      }

      console.log(`[billing-api] webhook:${requestId} verified event=${event.type} id=${event.id}`)

      switch (event.type) {
        case 'checkout.session.completed':
          await syncCheckoutSessionCompleted(admin, stripe, event.data.object)
          break
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await syncStripeSubscriptionEvent(admin, stripe, event.data.object, event.type)
          break
        case 'customer.subscription.deleted':
          await syncStripeSubscriptionEvent(admin, stripe, event.data.object, event.type)
          break
        case 'invoice.paid':
        case 'invoice.payment_succeeded':
          await syncInvoicePeriod(admin, stripe, event.data.object, event.type)
          break
        case 'invoice.payment_failed':
          await markSubscriptionPastDue(admin, stripe, event.data.object)
          break
        default:
          console.log(`[billing-api] webhook:${requestId} ignored unhandled event type=${event.type}`)
          break
      }

      console.log(`[billing-api] webhook:${requestId} handled event=${event.type}`)
      res.json({ received: true })
    } catch (error) {
      console.error(`[billing-api] webhook:${requestId} handler error`, error)
      if (!res.headersSent) {
        res.status(500).send(
          `Webhook handler failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        )
      }
    }
  },
)

app.use((error, _req, res, _next) => {
  console.error('[billing-api] unhandled Express error', error)
  if (!res.headersSent) {
    res.status(500).send('Internal server error')
  }
})

app.listen(env.port, () => {
  logServerStartup(env, envFileResult)
  console.log(`[billing-api] listening on http://localhost:${env.port}`)
  console.log(`[billing-api] health check: http://localhost:${env.port}/api/health`)
})

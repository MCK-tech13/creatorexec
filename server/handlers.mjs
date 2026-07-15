import { getWebhookEnvStatus, getServerEnv } from './env.mjs'
import { getBillingContext } from './billingContext.mjs'
import { verifySupabaseAccessToken } from './supabaseAdmin.mjs'
import { downsizeScreenshotForVision, parseDataUrl } from './imageDownsize.mjs'
import { extractTrendMetricsFromImage } from './productScoutOcr.mjs'
import {
  markSubscriptionPastDue,
  syncCheckoutSessionCompleted,
  syncInvoicePeriod,
  syncStripeSubscriptionEvent,
  upsertUserSubscription,
} from './subscriptionSync.mjs'
import { isAuthorizedCronRequest } from './uploadReminder.mjs'
import { runUploadReminderJob } from './uploadReminderJob.mjs'

function bearerToken(req) {
  const authHeader = req.headers.authorization ?? ''
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
}

export async function handleHealth(_req, res) {
  const { env } = getBillingContext()
  const webhook = getWebhookEnvStatus(env)
  res.status(200).json({
    ok: true,
    webhook: {
      configured: webhook.configured,
      prefix: webhook.prefix,
      looksLikeCliSecret: webhook.looksLikeCliSecret,
    },
  })
}

export async function handleCreateCheckoutSession(req, res) {
  try {
    const token = bearerToken(req)
    if (!token) {
      res.status(401).json({ error: 'Missing authorization token' })
      return
    }

    const { env, stripe, admin } = getBillingContext()
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
        trial_period_days: 7,
        metadata: {
          user_id: user.id,
          price_id: env.stripeBetaPriceId,
        },
      },
      custom_text: {
        submit: {
          message:
            "Beta pricing: $25/month while beta lasts. Start with a 7-day free trial — your card is saved at signup, but you won't be charged until the trial ends. Cancel anytime before day 8 and you won't be charged. Cancel anytime after that to stop future billing.",
        },
      },
    })

    if (!session.url) {
      res.status(500).json({ error: 'Stripe did not return a checkout URL' })
      return
    }

    res.status(200).json({ url: session.url })
  } catch (error) {
    console.error('[billing-api] create-checkout-session failed', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not start checkout',
    })
  }
}

export async function handleCreatePortalSession(req, res) {
  try {
    const token = bearerToken(req)
    if (!token) {
      res.status(401).json({ error: 'Missing authorization token' })
      return
    }

    const { env, stripe, admin } = getBillingContext()
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

    res.status(200).json({ url: portalSession.url })
  } catch (error) {
    console.error('[billing-api] create-portal-session failed', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not open billing portal',
    })
  }
}

export async function handleStripeWebhook(req, res, rawBody) {
  const requestId = crypto.randomUUID().slice(0, 8)
  const body = rawBody
  const bodyByteLength = Buffer.isBuffer(body) ? body.length : 0

  console.log(
    `[billing-api] webhook:${requestId} incoming type=${req.headers['content-type'] ?? 'none'} bytes=${bodyByteLength}`,
  )

  try {
    const { env, stripe, admin } = getBillingContext()

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
        `[billing-api] webhook:${requestId} empty or unparsed body — check Content-Type and raw body handling`,
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
      case 'invoice.finalized':
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
    res.status(200).json({ received: true })
  } catch (error) {
    console.error(`[billing-api] webhook:${requestId} handler error`, error)
    if (!res.headersSent) {
      res.status(500).send(
        `Webhook handler failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }
  }
}

/**
 * POST /api/product-scout/extract-screenshot
 * Body: { imageDataUrl: "data:image/...;base64,..." }
 */
export async function handleProductScoutExtractScreenshot(req, res) {
  try {
    const token = bearerToken(req)
    if (!token) {
      res.status(401).json({ error: 'Missing authorization token' })
      return
    }

    // Prefer full billing context when available; fall back to server env so OCR
    // can be exercised without requiring Stripe keys in local tooling.
    let supabaseUrl
    let supabaseAnonKey
    let anthropicApiKey
    try {
      const { env } = getBillingContext()
      supabaseUrl = env.supabaseUrl
      supabaseAnonKey = env.supabaseAnonKey
      anthropicApiKey = env.anthropicApiKey
    } catch {
      const { getServerEnv, loadEnvFile } = await import('./env.mjs')
      loadEnvFile()
      const env = getServerEnv()
      supabaseUrl = env.supabaseUrl
      supabaseAnonKey = env.supabaseAnonKey
      anthropicApiKey = env.anthropicApiKey
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      res.status(500).json({ error: 'Auth is not configured on the server.' })
      return
    }

    await verifySupabaseAccessToken(supabaseUrl, supabaseAnonKey, token)

    if (!anthropicApiKey) {
      res.status(503).json({
        error:
          'Screenshot reading is not configured yet. Enter the numbers manually, or ask support to enable ANTHROPIC_API_KEY.',
      })
      return
    }

    const imageDataUrl = typeof req.body?.imageDataUrl === 'string' ? req.body.imageDataUrl : null
    if (!imageDataUrl) {
      res.status(400).json({ error: 'Missing imageDataUrl' })
      return
    }

    // Reject absurd payloads early (client should downsize; this is a hard ceiling).
    if (imageDataUrl.length > 8_000_000) {
      res.status(413).json({ error: 'Screenshot is too large. Try a clearer crop of the metrics.' })
      return
    }

    const parsed = parseDataUrl(imageDataUrl)
    const resized = await downsizeScreenshotForVision(parsed.buffer)
    const metrics = await extractTrendMetricsFromImage({
      apiKey: anthropicApiKey,
      imageBase64: resized.buffer.toString('base64'),
      mediaType: resized.mediaType,
    })

    res.status(200).json({
      metrics,
      meta: {
        width: resized.width,
        height: resized.height,
        originalWidth: resized.originalWidth,
        originalHeight: resized.originalHeight,
      },
    })
  } catch (error) {
    console.error('[product-scout] extract-screenshot failed', error)
    const message =
      error instanceof Error
        ? error.message
        : 'Could not read that screenshot. Enter the numbers manually instead.'
    const status =
      typeof error?.status === 'number' && error.status === 429
        ? 429
        : typeof error?.status === 'number' && error.status >= 500
          ? 502
          : 400
    res.status(status).json({ error: message })
  }
}

/**
 * Vercel Cron → GET/POST /api/cron/upload-reminder
 * Protect with Authorization: Bearer $CRON_SECRET
 */
export async function handleUploadReminderCron(req, res) {
  const env = getServerEnv()
  const cronSecret = process.env.CRON_SECRET?.trim() || null
  const authHeader = req.headers.authorization ?? ''

  if (!isAuthorizedCronRequest(authHeader, cronSecret)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const dryRun =
    req.method === 'GET' &&
    (req.query?.dryRun === '1' ||
      req.query?.dryRun === 'true' ||
      req.url?.includes('dryRun=1') ||
      req.url?.includes('dryRun=true'))

  try {
    const summary = await runUploadReminderJob({ dryRun })
    const status = summary.ok ? 200 : 500
    res.status(status).json({
      ...summary,
      appUrl: env.appUrl,
    })
  } catch (error) {
    console.error('[upload-reminder] cron failed', error)
    // Supabase/PostgREST often throws plain objects ({ message, code, details, hint }),
    // not Error instances — surface those fields so Preview/manual curl shows the real cause.
    const message =
      error instanceof Error
        ? error.message
        : typeof error?.message === 'string'
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Upload reminder cron failed'
    res.status(500).json({
      ok: false,
      error: message,
      errorName: error instanceof Error ? error.name : typeof error,
      errorCode: typeof error?.code === 'string' ? error.code : null,
      errorDetails: typeof error?.details === 'string' ? error.details : null,
      errorHint: typeof error?.hint === 'string' ? error.hint : null,
      errorStack: error instanceof Error ? error.stack ?? null : null,
      // Temporary debug: full JSON-ish dump when it's not a standard Error
      errorRaw:
        error instanceof Error
          ? null
          : (() => {
              try {
                return JSON.parse(JSON.stringify(error))
              } catch {
                return String(error)
              }
            })(),
    })
  }
}

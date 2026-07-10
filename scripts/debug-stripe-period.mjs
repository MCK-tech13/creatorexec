/**
 * Inspect where Stripe stores billing period end for a subscription.
 * Usage: node scripts/debug-stripe-period.mjs sub_xxxxxxxx
 */
import Stripe from 'stripe'
import { loadEnvFile, assertBillingEnv } from '../server/env.mjs'
import {
  getSubscriptionPeriodEnd,
  logPeriodEndProbe,
  resolvePeriodEndUnix,
} from '../server/subscriptionSync.mjs'

loadEnvFile()

const subscriptionId = process.argv[2]
if (!subscriptionId) {
  console.error('Usage: node scripts/debug-stripe-period.mjs sub_xxxxxxxx')
  process.exit(1)
}

async function main() {
  const env = assertBillingEnv()
  const stripe = new Stripe(env.stripeSecretKey)

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price', 'latest_invoice'],
  })

  logPeriodEndProbe('debug-cli', subscription)

  const invoices = await stripe.invoices.list({ subscription: subscriptionId, limit: 3 })
  console.log('\n--- invoices.list ---')
  console.log(
    JSON.stringify(
      invoices.data.map((invoice) => ({
        id: invoice.id,
        status: invoice.status,
        period_start: invoice.period_start,
        period_end: invoice.period_end,
        linePeriodEnd: invoice.lines?.data?.[0]?.period?.end ?? null,
      })),
      null,
      2,
    ),
  )

  const resolved = await resolvePeriodEndUnix(stripe, subscription, 'debug-cli')
  console.log('\n--- resolvePeriodEndUnix ---')
  console.log(
    JSON.stringify(
      {
        unix: resolved,
        iso: resolved ? new Date(resolved * 1000).toISOString() : null,
        fromObjectOnly: getSubscriptionPeriodEnd(subscription),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

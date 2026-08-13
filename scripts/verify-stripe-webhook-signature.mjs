/**
 * Run: npm run verify:stripe-webhook-signature
 * No network. Uses Stripe's generateTestHeaderString.
 */
import Stripe from 'stripe'
import {
  constructEventWithSecrets,
  listWebhookSecrets,
  shouldProcessWebhookEvent,
} from '../server/webhookSignature.mjs'

const stripe = new Stripe('sk_test_webhook_signature_unit', { apiVersion: '2025-03-31.basil' })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function signedEvent({ livemode, secret, type = 'ping' }) {
  const payload = JSON.stringify({
    id: 'evt_test_signature',
    object: 'event',
    api_version: '2025-03-31.basil',
    created: 1_712_678_400,
    data: { object: {} },
    livemode,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
  })
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret })
  return { payload, signature }
}

function runListSecrets() {
  const secrets = listWebhookSecrets({
    stripeWebhookSecret: 'whsec_live',
    stripeWebhookSecretTest: 'whsec_test',
  })
  assert(secrets.join(',') === 'whsec_live,whsec_test', 'lists both secrets')

  const deduped = listWebhookSecrets({
    stripeWebhookSecret: 'whsec_same',
    stripeWebhookSecretTest: 'whsec_same',
  })
  assert(deduped.join(',') === 'whsec_same', 'dedupes identical secrets')

  const empty = listWebhookSecrets({
    stripeWebhookSecret: '  ',
    stripeWebhookSecretTest: null,
  })
  assert(empty.length === 0, 'ignores blank secrets')
  console.log('PASS: listWebhookSecrets')
}

function runConstructEvent() {
  const liveSecret = 'whsec_live_unit_secret'
  const testSecret = 'whsec_test_unit_secret'
  const secrets = [liveSecret, testSecret]

  const live = signedEvent({ livemode: true, secret: liveSecret })
  const liveResult = constructEventWithSecrets(stripe, live.payload, live.signature, secrets)
  assert(liveResult.event.livemode === true, 'live event livemode')
  assert(liveResult.secretIndex === 0, 'live secret is first match')

  const test = signedEvent({ livemode: false, secret: testSecret })
  const testResult = constructEventWithSecrets(stripe, test.payload, test.signature, secrets)
  assert(testResult.event.livemode === false, 'test event livemode')
  assert(testResult.secretIndex === 1, 'test secret is second match')

  const wrong = signedEvent({ livemode: false, secret: 'whsec_other' })
  try {
    constructEventWithSecrets(stripe, wrong.payload, wrong.signature, secrets)
    throw new Error('expected signature failure')
  } catch (error) {
    assert(
      error instanceof Error && /No signatures found matching the expected signature/i.test(error.message),
      'rejects unknown secret',
    )
  }

  try {
    constructEventWithSecrets(stripe, live.payload, live.signature, [])
    throw new Error('expected missing-secret failure')
  } catch (error) {
    assert(
      error instanceof Error && /STRIPE_WEBHOOK_SECRET is not configured/.test(error.message),
      'rejects empty secret list',
    )
  }

  console.log('PASS: constructEventWithSecrets')
}

function runProcessPolicy() {
  assert(shouldProcessWebhookEvent(true, 'sk_live_xxx') === true, 'live event + live key')
  assert(shouldProcessWebhookEvent(false, 'sk_live_xxx') === false, 'test event + live key ignored')
  assert(shouldProcessWebhookEvent(false, 'sk_test_xxx') === true, 'test event + test key processed')
  console.log('PASS: shouldProcessWebhookEvent')
}

runListSecrets()
runConstructEvent()
runProcessPolicy()
console.log('All webhook signature checks passed.')

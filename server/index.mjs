import express from 'express'
import { getWebhookEnvStatus, loadEnvFile, logServerStartup } from './env.mjs'
import { getBillingContext } from './billingContext.mjs'
import {
  handleCreateCheckoutSession,
  handleCreatePortalSession,
  handleHealth,
  handleStripeWebhook,
} from './handlers.mjs'
import { readRawBody } from './rawBody.mjs'

const envFileResult = loadEnvFile()
getBillingContext()

const app = express()

app.get('/api/health', (req, res) => {
  void handleHealth(req, res)
})

app.post('/api/stripe/create-checkout-session', express.json(), (req, res) => {
  void handleCreateCheckoutSession(req, res)
})

app.post('/api/stripe/create-portal-session', express.json(), (req, res) => {
  void handleCreatePortalSession(req, res)
})

app.post('/api/stripe/webhook', async (req, res) => {
  const rawBody = await readRawBody(req)
  await handleStripeWebhook(req, res, rawBody)
})

app.use((error, _req, res, _next) => {
  console.error('[billing-api] unhandled Express error', error)
  if (!res.headersSent) {
    res.status(500).send('Internal server error')
  }
})

const { env } = getBillingContext()

app.listen(env.port, () => {
  logServerStartup(env, envFileResult)
  console.log(`[billing-api] listening on http://localhost:${env.port}`)
  console.log(`[billing-api] health check: http://localhost:${env.port}/api/health`)
  console.log(`[billing-api] webhook configured: ${getWebhookEnvStatus(env).configured}`)
})

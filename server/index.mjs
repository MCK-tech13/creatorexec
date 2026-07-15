import express from 'express'
import { getWebhookEnvStatus, loadEnvFile, logServerStartup } from './env.mjs'
import { getBillingContext } from './billingContext.mjs'
import {
  handleCreateCheckoutSession,
  handleCreatePortalSession,
  handleHealth,
  handleProductScoutExtractScreenshot,
  handleStripeWebhook,
  handleUploadReminderCron,
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

app.post(
  '/api/product-scout/extract-screenshot',
  express.json({ limit: '6mb' }),
  (req, res) => {
    void handleProductScoutExtractScreenshot(req, res)
  },
)

app.get('/api/cron/upload-reminder', (req, res) => {
  void handleUploadReminderCron(req, res)
})

app.post('/api/cron/upload-reminder', express.json(), (req, res) => {
  void handleUploadReminderCron(req, res)
})

app.post('/api/stripe/webhook', async (req, res) => {
  const rawBody = await readRawBody(req)
  await handleStripeWebhook(req, res, rawBody)
})

app.use((error, _req, res, _next) => {
  console.error('[billing-api] unhandled Express error', error)
  if (!res.headersSent) {
    if (error?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Screenshot is too large. Try a clearer crop of the metrics.' })
      return
    }
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

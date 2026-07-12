import { handleStripeWebhook } from '../../server/handlers.mjs'
import { readRawBody } from '../../server/rawBody.mjs'

/** Vercel: disable automatic body parsing so Stripe signature verification works. */
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed')
    return
  }

  const rawBody = await readRawBody(req)
  return handleStripeWebhook(req, res, rawBody)
}

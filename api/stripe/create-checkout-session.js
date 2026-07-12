import { handleCreateCheckoutSession } from '../../server/handlers.mjs'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  return handleCreateCheckoutSession(req, res)
}

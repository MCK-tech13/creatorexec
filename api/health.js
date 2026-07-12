import { handleHealth } from '../server/handlers.mjs'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  return handleHealth(req, res)
}

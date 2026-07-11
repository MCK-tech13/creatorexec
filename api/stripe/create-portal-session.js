import { handleCreatePortalSession } from '../../server/handlers.mjs'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  return handleCreatePortalSession(req, res)
}

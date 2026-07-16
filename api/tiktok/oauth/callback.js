import { handleTikTokOAuthCallback } from '../../../server/tiktok/handlers.mjs'
import { loadEnvFile } from '../../../server/env.mjs'

loadEnvFile()

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  return handleTikTokOAuthCallback(req, res)
}

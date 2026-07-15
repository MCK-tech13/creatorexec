import { handleProductScoutExtractScreenshot } from '../../server/handlers.mjs'
import { loadEnvFile } from '../../server/env.mjs'

loadEnvFile()

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  return handleProductScoutExtractScreenshot(req, res)
}

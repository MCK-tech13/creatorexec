import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

function b64urlJson(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function fromB64url(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return Buffer.from(padded + pad, 'base64').toString('utf8')
}

function sign(payloadB64, secret) {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

/**
 * @param {string} userId
 * @param {string} secret
 * @param {number} [ttlSeconds]
 */
export function createOAuthState(userId, secret, ttlSeconds = 600) {
  if (!secret) throw new Error('OAuth state secret is not configured')
  const payload = {
    uid: userId,
    n: randomBytes(16).toString('hex'),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const payloadB64 = b64urlJson(payload)
  const sig = sign(payloadB64, secret)
  return `${payloadB64}.${sig}`
}

/**
 * @param {string} state
 * @param {string} secret
 * @returns {{ userId: string }}
 */
export function verifyOAuthState(state, secret) {
  if (!secret) throw new Error('OAuth state secret is not configured')
  if (typeof state !== 'string' || !state.includes('.')) {
    throw new Error('Invalid OAuth state')
  }
  const [payloadB64, sig] = state.split('.')
  const expected = sign(payloadB64, secret)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid OAuth state signature')
  }
  const payload = JSON.parse(fromB64url(payloadB64))
  if (!payload?.uid || typeof payload.exp !== 'number') {
    throw new Error('Invalid OAuth state payload')
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('OAuth state expired — try Connect TikTok again')
  }
  return { userId: payload.uid }
}

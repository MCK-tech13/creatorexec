/**
 * TikTok Login Kit + Display API helpers (server-only).
 */

import { getServerEnv } from '../env.mjs'

export const TIKTOK_AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/'
export const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/'
export const TIKTOK_REVOKE_URL = 'https://open.tiktokapis.com/v2/oauth/revoke/'
export const TIKTOK_USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/'
export const TIKTOK_DEFAULT_SCOPES = 'user.info.basic'
export const TIKTOK_DEFAULT_REDIRECT_URI =
  'https://www.creatorexec.app/api/tiktok/oauth/callback'

/**
 * @returns {{
 *   clientKey: string
 *   clientSecret: string
 *   redirectUri: string
 *   stateSecret: string
 *   appUrl: string
 * }}
 */
export function getTikTokConfig() {
  const env = getServerEnv()
  const clientKey = env.tiktokClientKey
  const clientSecret = env.tiktokClientSecret
  const redirectUri = env.tiktokRedirectUri
  const stateSecret = env.tiktokOAuthStateSecret
  const missing = []
  if (!clientKey) missing.push('TIKTOK_CLIENT_KEY')
  if (!clientSecret) missing.push('TIKTOK_CLIENT_SECRET')
  if (!stateSecret) missing.push('TIKTOK_OAUTH_STATE_SECRET (or CRON_SECRET)')
  if (missing.length > 0) {
    const err = new Error(`TikTok OAuth is not configured: missing ${missing.join(', ')}`)
    err.statusCode = 503
    throw err
  }
  return {
    clientKey,
    clientSecret,
    redirectUri,
    stateSecret,
    appUrl: env.appUrl.replace(/\/$/, ''),
  }
}

/**
 * @param {{
 *   clientKey: string
 *   redirectUri: string
 *   state: string
 *   scope?: string
 * }} options
 */
export function buildAuthorizeUrl(options) {
  const params = new URLSearchParams({
    client_key: options.clientKey,
    scope: options.scope || TIKTOK_DEFAULT_SCOPES,
    response_type: 'code',
    redirect_uri: options.redirectUri,
    state: options.state,
  })
  return `${TIKTOK_AUTHORIZE_URL}?${params.toString()}`
}

/**
 * @param {{
 *   clientKey: string
 *   clientSecret: string
 *   code: string
 *   redirectUri: string
 * }} options
 */
export async function exchangeAuthorizationCode(options) {
  const body = new URLSearchParams({
    client_key: options.clientKey,
    client_secret: options.clientSecret,
    code: options.code,
    grant_type: 'authorization_code',
    redirect_uri: options.redirectUri,
  })

  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.error) {
    const message =
      payload.error_description ||
      payload.error ||
      `TikTok token exchange failed (${response.status})`
    throw new Error(message)
  }
  return payload
}

/**
 * @param {{ clientKey: string, clientSecret: string, accessToken: string }} options
 */
export async function revokeAccessToken(options) {
  const body = new URLSearchParams({
    client_key: options.clientKey,
    client_secret: options.clientSecret,
    token: options.accessToken,
  })
  const response = await fetch(TIKTOK_REVOKE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.error) {
    const message =
      payload.error_description || payload.error || `TikTok revoke failed (${response.status})`
    throw new Error(message)
  }
  return payload
}

/**
 * @param {{ accessToken: string }} options
 */
export async function fetchTikTokUserInfo(options) {
  const fields = 'open_id,union_id,avatar_url,display_name'
  const url = `${TIKTOK_USER_INFO_URL}?fields=${encodeURIComponent(fields)}`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
    },
  })
  const payload = await response.json().catch(() => ({}))
  const errorCode = payload.error?.code
  if (!response.ok || (errorCode && errorCode !== 'ok')) {
    const message =
      payload.error?.message ||
      payload.error_description ||
      `TikTok user.info failed (${response.status})`
    throw new Error(message)
  }
  return payload.data?.user ?? null
}

/**
 * @param {object} tokenPayload
 * @param {object | null} user
 * @param {string} userId
 */
export function connectionRowFromTokenResponse(userId, tokenPayload, user) {
  const now = Date.now()
  const accessExpires =
    typeof tokenPayload.expires_in === 'number'
      ? new Date(now + tokenPayload.expires_in * 1000).toISOString()
      : null
  const refreshExpires =
    typeof tokenPayload.refresh_expires_in === 'number'
      ? new Date(now + tokenPayload.refresh_expires_in * 1000).toISOString()
      : null

  return {
    user_id: userId,
    open_id: tokenPayload.open_id || user?.open_id || '',
    display_name: user?.display_name ?? null,
    avatar_url: user?.avatar_url ?? null,
    scope: tokenPayload.scope ?? null,
    access_token: tokenPayload.access_token,
    refresh_token: tokenPayload.refresh_token ?? null,
    access_token_expires_at: accessExpires,
    refresh_token_expires_at: refreshExpires,
  }
}

export function publicConnectionView(row) {
  if (!row) return null
  return {
    connected: true,
    openId: row.open_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    scope: row.scope,
    connectedAt: row.connected_at,
  }
}

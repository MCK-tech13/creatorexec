import { loadEnvFile, getServerEnv } from '../env.mjs'
import { getSupabaseAdmin, verifySupabaseAccessToken } from '../supabaseAdmin.mjs'
import { createOAuthState, verifyOAuthState } from './oauthState.mjs'
import {
  buildAuthorizeUrl,
  connectionRowFromTokenResponse,
  exchangeAuthorizationCode,
  fetchTikTokUserInfo,
  getTikTokConfig,
  publicConnectionView,
  revokeAccessToken,
} from './client.mjs'

function bearerToken(req) {
  const authHeader = req.headers.authorization ?? ''
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
}

function ensureEnvLoaded() {
  loadEnvFile()
}

function getAdmin() {
  const env = getServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    const err = new Error('Supabase admin is not configured')
    err.statusCode = 503
    throw err
  }
  return getSupabaseAdmin(env.supabaseUrl, env.supabaseServiceRoleKey)
}

async function requireUser(req) {
  const env = getServerEnv()
  const token = bearerToken(req)
  if (!token) {
    const err = new Error('Missing authorization token')
    err.statusCode = 401
    throw err
  }
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    const err = new Error('Supabase auth is not configured')
    err.statusCode = 503
    throw err
  }
  try {
    return await verifySupabaseAccessToken(env.supabaseUrl, env.supabaseAnonKey, token)
  } catch {
    const err = new Error('Invalid or expired session')
    err.statusCode = 401
    throw err
  }
}

function retainersRedirect(appUrl, query) {
  const q = query ? `?${query}` : ''
  return `${appUrl}/app/retainers${q}`
}

/**
 * GET/POST /api/tiktok/oauth/start
 * Auth required. Returns { url } for TikTok authorize redirect.
 */
export async function startTikTokOAuth(req, res) {
  ensureEnvLoaded()
  try {
    const user = await requireUser(req)
    const config = getTikTokConfig()
    const state = createOAuthState(user.id, config.stateSecret)
    const url = buildAuthorizeUrl({
      clientKey: config.clientKey,
      redirectUri: config.redirectUri,
      state,
    })
    return res.status(200).json({ url })
  } catch (error) {
    const status = error.statusCode || 500
    return res.status(status).json({ error: error.message || 'Failed to start TikTok OAuth' })
  }
}

/**
 * GET /api/tiktok/oauth/callback
 * TikTok redirects here with ?code=&state= (or error=).
 * No Bearer — user identity is in signed state.
 */
export async function handleTikTokOAuthCallback(req, res) {
  ensureEnvLoaded()
  let appUrl = 'https://www.creatorexec.app'
  const fail = (reason) => {
    res.redirect(302, retainersRedirect(appUrl, `tiktok=error&reason=${encodeURIComponent(reason)}`))
  }

  try {
    const config = getTikTokConfig()
    appUrl = config.appUrl
    const q = req.query || {}
    if (q.error) {
      return fail(String(q.error_description || q.error))
    }

    const code = typeof q.code === 'string' ? q.code.trim() : ''
    const stateRaw = typeof q.state === 'string' ? q.state.trim() : ''
    if (!code || !stateRaw) {
      return fail('missing_code_or_state')
    }

    let userId
    try {
      ;({ userId } = verifyOAuthState(stateRaw, config.stateSecret))
    } catch (e) {
      return fail(e.message || 'invalid_state')
    }

    const tokens = await exchangeAuthorizationCode({
      clientKey: config.clientKey,
      clientSecret: config.clientSecret,
      code,
      redirectUri: config.redirectUri,
    })
    const profile = await fetchTikTokUserInfo({ accessToken: tokens.access_token })
    const row = connectionRowFromTokenResponse(userId, tokens, profile)
    if (!row.open_id) {
      return fail('missing_open_id')
    }

    const admin = getAdmin()
    const { error } = await admin.from('tiktok_connections').upsert(row, { onConflict: 'user_id' })
    if (error) {
      console.error('[tiktok/oauth/callback] upsert failed', error)
      return fail('save_failed')
    }

    return res.redirect(302, retainersRedirect(appUrl, 'tiktok=connected'))
  } catch (error) {
    console.error('[tiktok/oauth/callback]', error)
    return fail(error.message || 'callback_failed')
  }
}

/**
 * GET /api/tiktok/connection
 * Public profile fields only (no tokens).
 */
export async function getTikTokConnection(req, res) {
  ensureEnvLoaded()
  try {
    const user = await requireUser(req)
    const admin = getAdmin()
    const { data, error } = await admin
      .from('tiktok_connections')
      .select('open_id, display_name, avatar_url, scope, connected_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error
    return res.status(200).json({ connection: publicConnectionView(data) })
  } catch (error) {
    const status = error.statusCode || 500
    return res.status(status).json({ error: error.message || 'Failed to load TikTok connection' })
  }
}

/**
 * POST /api/tiktok/disconnect
 * Revoke token with TikTok (best-effort) and delete local row.
 */
export async function disconnectTikTok(req, res) {
  ensureEnvLoaded()
  try {
    const user = await requireUser(req)
    const admin = getAdmin()
    const { data: row, error: loadError } = await admin
      .from('tiktok_connections')
      .select('access_token')
      .eq('user_id', user.id)
      .maybeSingle()

    if (loadError) throw loadError

    if (row?.access_token) {
      try {
        const config = getTikTokConfig()
        await revokeAccessToken({
          clientKey: config.clientKey,
          clientSecret: config.clientSecret,
          accessToken: row.access_token,
        })
      } catch (e) {
        console.warn('[tiktok/disconnect] revoke failed (continuing delete):', e.message)
      }
    }

    const { error: deleteError } = await admin
      .from('tiktok_connections')
      .delete()
      .eq('user_id', user.id)
    if (deleteError) throw deleteError

    return res.status(200).json({ ok: true })
  } catch (error) {
    const status = error.statusCode || 500
    return res.status(status).json({ error: error.message || 'Failed to disconnect TikTok' })
  }
}

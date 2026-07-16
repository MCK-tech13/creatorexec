/**
 * Run: npx tsx scripts/verify-tiktok-oauth.ts
 */
import {
  buildAuthorizeUrl,
  connectionRowFromTokenResponse,
  publicConnectionView,
  TIKTOK_AUTHORIZE_URL,
  TIKTOK_DEFAULT_REDIRECT_URI,
  TIKTOK_DEFAULT_SCOPES,
} from '../server/tiktok/client.mjs'
import { createOAuthState, verifyOAuthState } from '../server/tiktok/oauthState.mjs'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function runAuthorizeUrl(): void {
  const url = buildAuthorizeUrl({
    clientKey: 'test_client_key',
    redirectUri: TIKTOK_DEFAULT_REDIRECT_URI,
    state: 'abc.def',
  })
  assert(url.startsWith(TIKTOK_AUTHORIZE_URL), 'authorize base URL')
  const parsed = new URL(url)
  assert(parsed.searchParams.get('client_key') === 'test_client_key', 'client_key')
  assert(parsed.searchParams.get('response_type') === 'code', 'response_type')
  assert(parsed.searchParams.get('scope') === TIKTOK_DEFAULT_SCOPES, 'scope')
  assert(parsed.searchParams.get('redirect_uri') === TIKTOK_DEFAULT_REDIRECT_URI, 'redirect_uri')
  assert(parsed.searchParams.get('state') === 'abc.def', 'state')
  console.log('Authorize URL checks passed.')
}

function runOAuthState(): void {
  const secret = 'verify-tiktok-state-secret'
  const state = createOAuthState('user-123', secret, 60)
  const parsed = verifyOAuthState(state, secret)
  assert(parsed.userId === 'user-123', 'round-trip userId')

  try {
    verifyOAuthState(state, 'wrong-secret')
    throw new Error('expected signature failure')
  } catch (e) {
    assert(e instanceof Error && /signature/i.test(e.message), 'rejects bad signature')
  }

  const expired = createOAuthState('user-123', secret, -10)
  try {
    verifyOAuthState(expired, secret)
    throw new Error('expected expiry failure')
  } catch (e) {
    assert(e instanceof Error && /expired/i.test(e.message), 'rejects expired state')
  }

  console.log('OAuth state checks passed.')
}

function runConnectionMappers(): void {
  const row = connectionRowFromTokenResponse(
    'user-1',
    {
      open_id: 'oid-1',
      access_token: 'tok',
      refresh_token: 'ref',
      expires_in: 3600,
      refresh_expires_in: 86400,
      scope: 'user.info.basic',
    },
    { open_id: 'oid-1', display_name: 'Demo', avatar_url: 'https://example.com/a.png' },
  )
  assert(row.user_id === 'user-1', 'user_id')
  assert(row.open_id === 'oid-1', 'open_id')
  assert(row.display_name === 'Demo', 'display_name')
  assert(typeof row.access_token_expires_at === 'string', 'access expiry')
  assert(typeof row.refresh_token_expires_at === 'string', 'refresh expiry')

  const pub = publicConnectionView({
    ...row,
    connected_at: '2026-07-16T00:00:00.000Z',
  })
  assert(pub?.connected === true, 'public connected')
  assert(pub?.displayName === 'Demo', 'public displayName')
  assert(!('access_token' in (pub as object)), 'public view has no access_token')
  assert(publicConnectionView(null) === null, 'null row')

  console.log('Connection mapper checks passed.')
}

runAuthorizeUrl()
runOAuthState()
runConnectionMappers()
console.log('verify-tiktok-oauth: all checks passed.')

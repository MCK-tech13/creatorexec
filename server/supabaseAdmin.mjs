import { createClient } from '@supabase/supabase-js'

let adminClient = null

export function getSupabaseAdmin(url, serviceRoleKey) {
  if (!adminClient) {
    adminClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return adminClient
}

export async function verifySupabaseAccessToken(url, anonKey, accessToken) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.auth.getUser(accessToken)
  if (error || !data.user) {
    throw new Error('Invalid or expired session')
  }
  return data.user
}

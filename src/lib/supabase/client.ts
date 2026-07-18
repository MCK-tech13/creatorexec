import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const viteEnv =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : ({} as ImportMetaEnv)
const supabaseUrl = viteEnv.VITE_SUPABASE_URL
const supabaseAnonKey = viteEnv.VITE_SUPABASE_ANON_KEY

let client: SupabaseClient<Database> | null = null

function assertSupabaseEnv(): { url: string; anonKey: string } {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env',
    )
  }

  return { url: supabaseUrl, anonKey: supabaseAnonKey }
}

/** Browser Supabase client (anon key) with persistent auth sessions. */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!client) {
    const { url, anonKey } = assertSupabaseEnv()
    client = createClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }

  return client
}

/** Create a standalone client (scripts/tests). */
export function createSupabaseClient(
  url: string,
  anonKey: string,
): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

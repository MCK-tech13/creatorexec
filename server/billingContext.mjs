import Stripe from 'stripe'
import { assertBillingEnv, loadEnvFile } from './env.mjs'
import { getSupabaseAdmin } from './supabaseAdmin.mjs'

let context = null

/** Shared Stripe + Supabase admin clients (local Express and Vercel serverless). */
export function getBillingContext() {
  if (!context) {
    loadEnvFile()
    const env = assertBillingEnv()
    context = {
      env,
      stripe: new Stripe(env.stripeSecretKey),
      admin: getSupabaseAdmin(env.supabaseUrl, env.supabaseServiceRoleKey),
    }
  }
  return context
}

export function resetBillingContext() {
  context = null
}

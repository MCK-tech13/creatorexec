import { getSupabaseClient } from '../supabase/client'
import type { Database } from '../supabase/database.types'
import { mapSubscriptionRow, type UserSubscription } from './subscription'

type SubscriptionRow = Database['public']['Tables']['user_subscriptions']['Row']

export async function fetchUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await getSupabaseClient()
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) return null
  return mapSubscriptionRow(data as SubscriptionRow)
}

export async function startCheckoutSession(accessToken: string): Promise<string> {
  const response = await fetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })

  const payload = (await response.json()) as { url?: string; error?: string }
  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? 'Could not start checkout')
  }

  return payload.url
}

export async function openBillingPortal(accessToken: string): Promise<string> {
  const response = await fetch('/api/stripe/create-portal-session', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })

  const payload = (await response.json()) as { url?: string; error?: string }
  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? 'Could not open billing portal')
  }

  return payload.url
}

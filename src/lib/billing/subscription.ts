import type { Database } from '../supabase/database.types'

export type SubscriptionStatus = Database['public']['Enums']['subscription_status']

export interface UserSubscription {
  userId: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: SubscriptionStatus
  priceId: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export type SubscriptionAccessLevel = 'full' | 'grace' | 'blocked'

export interface SubscriptionAccess {
  level: SubscriptionAccessLevel
  reason:
    | 'active'
    | 'trialing'
    | 'past_due_grace'
    | 'canceled_until_period_end'
    | 'payment_required'
    | 'loading'
  showBillingBanner: boolean
  bannerMessage: string | null
}

/** Production policy: grace_period — full access on past_due with billing banner. */
export type AccessPolicyMode = 'grace_period' | 'hard_lockout' | 'read_only_on_lapse'

export const ACCESS_POLICY_MODE: AccessPolicyMode = 'grace_period'

export function mapSubscriptionRow(
  row: Database['public']['Tables']['user_subscriptions']['Row'],
): UserSubscription {
  return {
    userId: row.user_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    subscriptionStatus: row.subscription_status,
    priceId: row.price_id,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
  }
}

function isPeriodStillActive(periodEnd: string | null): boolean {
  if (!periodEnd) return false
  return new Date(periodEnd).getTime() > Date.now()
}

export function evaluateSubscriptionAccess(
  subscription: UserSubscription | null,
  mode: AccessPolicyMode = ACCESS_POLICY_MODE,
): SubscriptionAccess {
  if (!subscription) {
    return {
      level: 'blocked',
      reason: 'payment_required',
      showBillingBanner: false,
      bannerMessage: null,
    }
  }

  const { subscriptionStatus, cancelAtPeriodEnd, currentPeriodEnd } = subscription

  if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
    const cancelingSoon = cancelAtPeriodEnd && isPeriodStillActive(currentPeriodEnd)
    return {
      level: 'full',
      reason: subscriptionStatus === 'trialing' ? 'trialing' : 'active',
      showBillingBanner: cancelingSoon,
      bannerMessage: cancelingSoon
        ? `Your subscription ends on ${formatPeriodEnd(currentPeriodEnd)}. Manage billing to stay subscribed.`
        : null,
    }
  }

  if (
    subscriptionStatus === 'canceled' &&
    cancelAtPeriodEnd &&
    isPeriodStillActive(currentPeriodEnd)
  ) {
    return {
      level: 'full',
      reason: 'canceled_until_period_end',
      showBillingBanner: true,
      bannerMessage: `Access continues until ${formatPeriodEnd(currentPeriodEnd)}. Manage billing to resubscribe.`,
    }
  }

  if (subscriptionStatus === 'past_due') {
    if (mode === 'grace_period') {
      return {
        level: 'grace',
        reason: 'past_due_grace',
        showBillingBanner: true,
        bannerMessage:
          'Your last payment failed. Update your payment method to avoid losing access.',
      }
    }
    if (mode === 'read_only_on_lapse') {
      return {
        level: 'grace',
        reason: 'past_due_grace',
        showBillingBanner: true,
        bannerMessage: 'Payment failed — app is read-only until billing is updated.',
      }
    }
    return {
      level: 'blocked',
      reason: 'payment_required',
      showBillingBanner: false,
      bannerMessage: null,
    }
  }

  if (
    subscriptionStatus === 'canceled' &&
    isPeriodStillActive(currentPeriodEnd) &&
    mode === 'grace_period'
  ) {
    return {
      level: 'full',
      reason: 'canceled_until_period_end',
      showBillingBanner: true,
      bannerMessage: `Access continues until ${formatPeriodEnd(currentPeriodEnd)}.`,
    }
  }

  return {
    level: 'blocked',
    reason: 'payment_required',
    showBillingBanner: false,
    bannerMessage: null,
  }
}

export function hasAppAccess(access: SubscriptionAccess): boolean {
  return access.level === 'full' || access.level === 'grace'
}

export function isReadOnlyAccess(
  access: SubscriptionAccess,
  mode: AccessPolicyMode = ACCESS_POLICY_MODE,
): boolean {
  return mode === 'read_only_on_lapse' && access.reason === 'past_due_grace'
}

function formatPeriodEnd(value: string | null): string {
  if (!value) return 'the end of your billing period'
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

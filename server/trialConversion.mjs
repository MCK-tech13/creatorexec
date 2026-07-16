/**
 * Detect the first paid invoice after a Stripe trial ends.
 * Pure helpers — safe to unit test without Stripe/network.
 */

const TRIAL_END_SKEW_SECONDS = 2 * 24 * 60 * 60 // 48h

/**
 * @param {unknown} invoice
 * @returns {number}
 */
export function invoiceAmountPaid(invoice) {
  if (!invoice || typeof invoice !== 'object') return 0
  const amount = /** @type {{ amount_paid?: unknown }} */ (invoice).amount_paid
  return typeof amount === 'number' && amount > 0 ? amount : 0
}

/**
 * @param {unknown} invoice
 * @returns {number | null}
 */
export function invoicePeriodStart(invoice) {
  if (!invoice || typeof invoice !== 'object') return null
  const inv = /** @type {any} */ (invoice)
  const lineStart = inv.lines?.data?.[0]?.period?.start
  if (typeof lineStart === 'number' && lineStart > 0) return lineStart
  if (typeof inv.period_start === 'number' && inv.period_start > 0) return inv.period_start
  return null
}

/**
 * True only for the first real charge after a trial — not $0 trial invoices,
 * not never-trialed subscriptions, not later renewals.
 *
 * Signals:
 * - amount_paid > 0
 * - billing_reason === 'subscription_cycle' (Stripe's post-trial first charge)
 * - subscription.trial_end set (had a trial)
 * - invoice period_start ≈ trial_end (within 48h) so month-2+ renewals don't match
 *
 * @param {unknown} invoice
 * @param {unknown} subscription
 */
export function isTrialConversionInvoice(invoice, subscription) {
  if (!invoice || typeof invoice !== 'object') return false
  if (!subscription || typeof subscription !== 'object') return false

  const inv = /** @type {any} */ (invoice)
  const sub = /** @type {any} */ (subscription)

  if (invoiceAmountPaid(invoice) <= 0) return false
  if (inv.billing_reason !== 'subscription_cycle') return false

  const trialEnd = sub.trial_end
  if (typeof trialEnd !== 'number' || trialEnd <= 0) return false

  const periodStart = invoicePeriodStart(invoice)
  if (typeof periodStart === 'number') {
    return Math.abs(periodStart - trialEnd) <= TRIAL_END_SKEW_SECONDS
  }

  const created = inv.created
  if (typeof created !== 'number' || created <= 0) return false
  if (created < trialEnd - 3600) return false
  return created - trialEnd <= TRIAL_END_SKEW_SECONDS
}

/**
 * Only send conversion email for paid invoice events (not finalized-before-pay).
 * @param {string | null | undefined} eventType
 */
export function shouldAttemptTrialConversionEmail(eventType) {
  return eventType === 'invoice.paid' || eventType === 'invoice.payment_succeeded'
}

/**
 * price_id → human-readable plan display name.
 *
 * Amount and billing interval are NEVER stored here — those come from Stripe
 * at send time (unit_amount + recurring.interval). This map only names plans.
 *
 * Extend by:
 * 1. Adding a static entry below when you create a new Stripe Price, or
 * 2. Setting STRIPE_PRICE_DISPLAY_NAMES={"price_xxx":"CreatorExec — Yearly"}
 *
 * STRIPE_BETA_PRICE_ID is auto-mapped to "Beta — Monthly" so the current beta
 * price stays labeled without hardcoding its dollar amount.
 */

/** @type {Record<string, string>} */
const STATIC_PLAN_NAMES = {
  // Live beta monthly (extend as you add tiers):
  // 'price_1Tsl5A…': 'Beta — Monthly',
  // 'price_…': 'CreatorExec — Monthly',
  // 'price_…': 'CreatorExec — Yearly',
}

/**
 * @returns {Record<string, string>}
 */
export function getPlanDisplayNameCatalog() {
  /** @type {Record<string, string>} */
  const catalog = { ...STATIC_PLAN_NAMES }

  const betaPriceId = process.env.STRIPE_BETA_PRICE_ID?.trim()
  if (betaPriceId && !catalog[betaPriceId]) {
    catalog[betaPriceId] = 'Beta — Monthly'
  }

  const rawExtra = process.env.STRIPE_PRICE_DISPLAY_NAMES?.trim()
  if (rawExtra) {
    try {
      const parsed = JSON.parse(rawExtra)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [priceId, name] of Object.entries(parsed)) {
          if (typeof priceId === 'string' && typeof name === 'string' && priceId && name) {
            catalog[priceId] = name
          }
        }
      }
    } catch (error) {
      console.warn(
        '[billing-api] STRIPE_PRICE_DISPLAY_NAMES is not valid JSON — ignored',
        error instanceof Error ? error.message : error,
      )
    }
  }

  return catalog
}

/**
 * @param {string | null | undefined} priceId
 * @returns {string}
 */
export function getPlanDisplayName(priceId) {
  if (!priceId) return 'CreatorExec'
  const catalog = getPlanDisplayNameCatalog()
  return catalog[priceId] ?? 'CreatorExec'
}

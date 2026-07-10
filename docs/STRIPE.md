# Stripe billing setup

Subscription checkout, webhooks, and Supabase `user_subscriptions` for CreatorExec.

## 1. Credentials

In the [Stripe Dashboard](https://dashboard.stripe.com) (**Test mode** on):

1. **Developers** → **API keys**
   - Publishable key → `VITE_STRIPE_PUBLISHABLE_KEY` (optional for hosted Checkout redirect flow)
   - Secret key → `STRIPE_SECRET_KEY`
2. **Product catalog** → your $25/month beta price → Price ID → `STRIPE_BETA_PRICE_ID`
3. **Settings** → **Billing** → **Customer portal** → activate (cancel, update payment method, invoices)

```bash
cp .env.example .env
```

Add to `.env`:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_BETA_PRICE_ID=price_...
APP_URL=http://localhost:5173
STRIPE_API_PORT=4242
```

`STRIPE_WEBHOOK_SECRET` is added after webhook forwarding is running (see below).

## 2. Supabase migration

Run in SQL Editor:

`supabase/migrations/20260710000000_user_subscriptions.sql`

Creates `user_subscriptions` with `subscription_status` enum and RLS (users read own row; webhooks write via service role).

## 3. Local development

Use **two terminals**:

```bash
# Terminal 1 — billing API (checkout + webhooks)
npm run dev:api

# Terminal 2 — Vite app (proxies /api → :4242)
npm run dev
```

## 4. Stripe CLI — local webhooks

Install: https://docs.stripe.com/stripe-cli

```bash
# Log in once
stripe login

# Forward webhooks to the local billing API
stripe listen --forward-to localhost:4242/api/stripe/webhook
```

Copy the printed `whsec_...` into `.env` as `STRIPE_WEBHOOK_SECRET`, then **restart** `npm run dev:api`.

Trigger test events (optional):

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

## 5. Manual test flow

1. Sign up → redirected to `/subscribe`
2. Click **Subscribe with Stripe Checkout**
3. Pay with test card `4242 4242 4242 4242` (any future expiry / CVC)
4. Return to app → `/app` loads with `subscription_status = active`
5. **Manage billing** opens Stripe Customer Portal (cancel, update card)

Declined card: `4000 0000 0000 0002`

## 6. Verify in Supabase

```sql
select user_id, subscription_status, stripe_customer_id, stripe_subscription_id,
       current_period_end, cancel_at_period_end, updated_at
from user_subscriptions
order by updated_at desc;
```

## 7. Automated test

```bash
npm run test:stripe
```

Uses Stripe **test mode** only. Simulates webhook sync, cancellation, and failed payment; prints Supabase rows as proof.

## 8. Access gating policy

Configured in `src/lib/billing/subscription.ts` via `ACCESS_POLICY_MODE`:

| Mode | `past_due` | Canceled (period ended) |
|------|------------|-------------------------|
| `grace_period` (default) | Full access + billing banner | Blocked → `/subscribe` |
| `hard_lockout` | Blocked immediately | Blocked |
| `read_only_on_lapse` | Read-only + banner (future UI hook) | Blocked |

Change the constant after deciding with the team.

## 9. Refund policy (checkout copy)

- 7-day money-back: manual refund in Stripe Dashboard → Payments → Refund (not automated)
- Cancel anytime: Customer Portal stops future billing; access until `current_period_end`

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

**Important:** Use the secret from the **current** `stripe listen` session (it changes each restart). The Dashboard webhook signing secret is different and will not work with `stripe listen`.

### Verify env vars are loaded

On startup, `npm run dev:api` prints a masked checklist. Look for:

```
STRIPE_WEBHOOK_SECRET: whsec_12… (xx chars)
```

Quick check while the server is running:

```bash
curl http://localhost:4242/api/health
```

If `webhook.configured` is `false`, webhooks return 500 — add `STRIPE_WEBHOOK_SECRET` to `.env` and restart the billing API.

Production (`https://www.creatorexec.app/api/stripe/webhook`) uses the **live** Dashboard signing secret. Apex (`https://creatorexec.app/…`) 308-redirects to www; Stripe will not follow that redirect. If a **test-mode** Dashboard endpoint also posts to the www URL, set `STRIPE_WEBHOOK_SECRET_TEST` as well — the two `whsec_` values are different.

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

### Welcome email (Resend)

After `checkout.session.completed` upserts `user_subscriptions`, the webhook sends a branded welcome email via Resend (`RESEND_API_KEY`).

- Amount and billing interval are read from the Stripe subscription price object (`unit_amount`, `recurring.interval`) — never hardcoded in the template.
- Plan display name comes from `server/planCatalog.mjs` (`STRIPE_BETA_PRICE_ID` → **Beta — Monthly**, plus optional `STRIPE_PRICE_DISPLAY_NAMES` JSON).

```bash
# HTML preview (writes /opt/cursor/artifacts/welcome-email-preview.html)
npm run preview:welcome-email

# Unit checks (no network)
npm run test:welcome-email

# Optional live send
SEND_WELCOME_EMAIL=1 RESEND_API_KEY=re_... WELCOME_EMAIL_TO=you@example.com npm run test:welcome-email
```

Email failures are logged and never fail the webhook / subscription write.

### Trial conversion email (Resend)

After a **trialing** subscription’s first real charge, `invoice.paid` / `invoice.payment_succeeded` may send a trial-conversion email.

Detection (`server/trialConversion.mjs`):

- `amount_paid > 0`
- `billing_reason === 'subscription_cycle'`
- subscription has `trial_end` (never-trialed users are skipped)
- invoice `period_start` ≈ `trial_end` (within 48h) so later renewals don’t match
- idempotency: `user_subscriptions.trial_conversion_email_sent_at`

```bash
# Apply migration first:
#   supabase/migrations/20260716000001_trial_conversion_email.sql

npm run preview:trial-conversion-email
npm run test:trial-conversion-email

# Optional live send
SEND_TRIAL_CONVERSION_EMAIL=1 RESEND_API_KEY=re_... TRIAL_CONVERSION_EMAIL_TO=you@example.com \
  npm run test:trial-conversion-email
```

**Important:** plain `stripe trigger invoice.paid` uses a generic fixture that **will not** pass the trial-conversion detector (no matching `trial_end` / period). Use a short trial + listen (see below), or a Test Clock.

#### Stripe CLI — fire a real post-trial `invoice.paid` against Preview

1. Install + auth Stripe CLI (test mode):
   ```bash
   stripe login
   ```
2. Forward webhooks to Preview (or local `npm run dev:api`):
   ```bash
   stripe listen --forward-to https://YOUR-PREVIEW.vercel.app/api/stripe/webhook
   # copy the whsec_… into Preview STRIPE_WEBHOOK_SECRET if testing Preview,
   # or use the printed secret only for local.
   ```
3. Create a test customer + attach a test card + start a subscription whose trial ends in ~1–2 minutes
   (Dashboard → Subscriptions → create with trial end soon, **or** API):
   ```bash
   # Example (replace price / customer):
   TRIAL_END=$(($(date +%s) + 90))
   stripe subscriptions create \
     --customer cus_xxx \
     --items[0][price]=$STRIPE_BETA_PRICE_ID \
     --trial-end $TRIAL_END \
     --default-payment-method pm_card_visa
   ```
4. Wait for trial to end (or advance a **Test Clock** past `trial_end`). Stripe emits `invoice.paid` with `billing_reason=subscription_cycle` and `amount_paid>0`.
5. Confirm:
   - `stripe listen` shows `invoice.paid` → 200
   - Vercel / local logs: `trial-conversion-email: sending` then `sent id=…`
   - Resend dashboard shows the email
   - Supabase `user_subscriptions.trial_conversion_email_sent_at` is set

## 8. Access gating policy

**Production choice: `grace_period`** (set in `src/lib/billing/subscription.ts`).

| Status | Behavior |
|--------|----------|
| No subscription | Blocked → `/subscribe` |
| `active` / `trialing` | Full access |
| `past_due` | Full access + billing banner + link to Customer Portal |
| Canceled, still in paid period | Full access + banner until `current_period_end` |
| Canceled / unpaid after period | Blocked → `/subscribe` |

## 9. Trial policy (checkout)

- New Checkout sessions set `subscription_data.trial_period_days: 7` (card collected; charge after trial)
- Cancel during trial: no charge; app access follows Stripe `trialing` / period end
- Cancel anytime after trial: Customer Portal stops future billing; access until `current_period_end`
- Existing subscribers who signed up under the prior refund model keep their original terms; new checkouts use trial only

## 10. `current_period_end` and Stripe API Basil (2025-03-31)

Stripe moved `current_period_end` off the Subscription object. The sync resolves period end from, in order:

1. **`checkout.session.completed`**: `session.invoice` → `invoice.period_end` (with short retries while Stripe finalizes)
2. `subscription.items.data[].current_period_end` (Basil)
3. `subscription.current_period_end` (legacy webhooks)
4. `subscription.latest_invoice.period_end`
5. `invoices.list({ subscription })` → `period_end`

**Basil invoice change:** subscription id is at `invoice.parent.subscription_details.subscription`, not `invoice.subscription`. `invoice.paid` / `invoice.finalized` handlers use the new path.

During live checkout, Terminal 1 logs:

```
[billing-api] checkout.session.completed:handler-start
[billing-api] checkout.session.completed:session-invoice
[billing-api] checkout.session.completed:row-before-upsert
```

Debug a live subscription:

```bash
npm run debug:stripe-period -- sub_xxxxxxxx
```

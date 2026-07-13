# Production deployment (Vercel)

CreatorExec deploys as **one Vercel project**: the Vite frontend (`dist/`) plus serverless API routes in `api/` (Stripe checkout + webhooks).

Local dev still uses two terminals (`npm run dev` + `npm run dev:api`). Production uses the same `/api/*` paths on your domain — no separate API host.

---

## Architecture

| Path | Local dev | Production (Vercel) |
|------|-----------|---------------------|
| `/`, `/app`, `/login`, … | Vite `:5173` | Static SPA from `dist/` |
| `/api/health` | Express `:4242` | Serverless `api/health.js` |
| `/api/stripe/create-checkout-session` | Express | `api/stripe/create-checkout-session.js` |
| `/api/stripe/create-portal-session` | Express | `api/stripe/create-portal-session.js` |
| `/api/stripe/webhook` | Express + `stripe listen` | `api/stripe/webhook.js` |

**Recommendation:** Stay on Vercel only. No Railway/Render needed unless you outgrow serverless limits. One dashboard, one deploy, same domain for frontend + API.

---

## Part A — What you configure (Vercel dashboard)

Open [vercel.com](https://vercel.com) → your **creatorexec** project → **Settings** → **Environment Variables**.

Add each variable for **Production** (and Preview if you want staging). Click **Save**, then **Redeploy** after all vars are set.

### A1. Frontend (client-safe — embedded at build time)

These use the `VITE_` prefix. Safe in the browser (same as your local `.env`).

| Variable name | Where the value comes from | Example source in local `.env` |
|---------------|---------------------------|--------------------------------|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Settings → API → **Project URL** | Same key in your `.env` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → **anon public** key | Same key in your `.env` |

Optional (not required for hosted Checkout today):

| Variable name | Source |
|---------------|--------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys → **Publishable key** |

### A2. API server (server-only — never use `VITE_` prefix)

Same Vercel project, but only used by `/api/*` serverless functions. **Never** prefix these with `VITE_`.

| Variable name | Where the value comes from |
|---------------|---------------------------|
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Same as `VITE_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** (secret) |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → **Secret key** |
| `STRIPE_BETA_PRICE_ID` | Stripe → Product catalog → your $25/mo price → **Price ID** (`price_…`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → your **production** endpoint → Signing secret (see Part C) |
| `RESEND_API_KEY` | Resend Dashboard → API Keys (used to send the post-checkout welcome email) |
| `APP_URL` | Your live site URL: `https://creatorexec.app` (or `https://www.creatorexec.app`) |

Optional:

| Variable name | Source |
|---------------|--------|
| `STRIPE_PRICE_DISPLAY_NAMES` | JSON map of additional Stripe price IDs → email plan labels, e.g. `{"price_xxx":"CreatorExec — Yearly"}`. `STRIPE_BETA_PRICE_ID` is auto-labeled **Beta — Monthly**. |

**Do NOT add to Vercel:** `STRIPE_API_PORT` (local only).

After saving variables: **Deployments** → latest deployment → **⋯** → **Redeploy** (env changes require a new build).

---

## Part B — What the code handles (already in repo)

- `vercel.json` — Vite build + SPA routing + `/api` passthrough
- `api/` — serverless wrappers calling shared `server/handlers.mjs`
- `server/index.mjs` — unchanged local Express server for `npm run dev:api`

No separate API hosting setup required.

---

## Part C — Stripe production webhook

Local `stripe listen` is **only for development**. Production uses a Dashboard webhook.

1. Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**
2. **Endpoint URL:**

   ```
   https://creatorexec.app/api/stripe/webhook
   ```

3. **Events to send** (minimum):
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_succeeded`
   - `invoice.finalized`
   - `invoice.payment_failed`

4. After creating, open the endpoint → **Signing secret** → copy `whsec_…`
5. Paste into Vercel as `STRIPE_WEBHOOK_SECRET` (Production)
6. Redeploy Vercel

Use the **Dashboard** signing secret in production — not the secret from `stripe listen`.

---

## Part D — Supabase auth URLs

Supabase Dashboard → **Authentication** → **URL Configuration**:

| Field | Value |
|-------|-------|
| Site URL | `https://creatorexec.app` |
| Redirect URLs | `https://creatorexec.app/reset-password` |

(Keep `http://localhost:5173/reset-password` for local dev.)

---

## Part E — Ordered checklist

### You do

1. [ ] Vercel → Settings → Environment Variables → add all vars from Part A1 + A2
2. [ ] Set `APP_URL` = `https://creatorexec.app`
3. [ ] Redeploy Vercel after env vars are saved
4. [ ] Supabase → Auth URL Configuration (Part D)
5. [ ] Stripe → Add production webhook `https://creatorexec.app/api/stripe/webhook` (Part C)
6. [ ] Copy production `whsec_…` → Vercel `STRIPE_WEBHOOK_SECRET` → Redeploy again
7. [ ] Confirm Supabase migration `20260710000000_user_subscriptions.sql` is applied (if not already)

### Code (done in repo)

- [x] Vercel serverless API routes
- [x] Shared handlers for local + production
- [x] SPA rewrite for React Router

---

## Part F — Verify production

### 1. Health check

```bash
curl https://creatorexec.app/api/health
```

Expected:

```json
{"ok":true,"webhook":{"configured":true,"prefix":"whsec_","looksLikeCliSecret":true}}
```

If `webhook.configured` is `false`, `STRIPE_WEBHOOK_SECRET` is missing on Vercel.

### 2. Frontend / Supabase

1. Open `https://creatorexec.app` — should **not** show "Supabase not configured"
2. Sign up with a new test email
3. Complete onboarding → `/subscribe`

### 3. Checkout + webhook

1. Subscribe with Stripe test card `4242 4242 4242 4242` (test mode) or live card (live mode)
2. Stripe Dashboard → Developers → **Events** — confirm `checkout.session.completed` → your endpoint → **200**
3. Vercel → Project → **Logs** (Runtime) — look for `[billing-api] webhook:… handled event=checkout.session.completed`

### 4. Supabase row

```sql
select user_id, subscription_status, current_period_end, stripe_subscription_id, updated_at
from user_subscriptions
order by updated_at desc
limit 5;
```

Expect `subscription_status = active` and `current_period_end` populated.

### 5. App access

- Return to `https://creatorexec.app/app` — dashboard loads (subscription gate passes)
- **Manage billing** opens Stripe Customer Portal

---

## Local dev (unchanged)

```bash
# Terminal 1
npm run dev:api

# Terminal 2
npm run dev

# Terminal 3 (webhooks)
stripe listen --forward-to localhost:4242/api/stripe/webhook
```

Local `.env` stays on your machine — never commit it.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Supabase not configured" on live site | Add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` on Vercel, redeploy |
| Checkout button errors / "billing API" | Add server vars (Part A2), redeploy; check `/api/health` |
| Webhook 500 | Set `STRIPE_WEBHOOK_SECRET` to **production** Dashboard secret, redeploy |
| Webhook 400 signature | Wrong secret (CLI secret on production) — use Dashboard `whsec_` |
| 404 on `/app` after refresh | Redeploy — `vercel.json` SPA rewrite must be active |

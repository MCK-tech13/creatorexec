# Supabase Phase 1 setup

Database foundation for migrating localStorage domains to Postgres with row level security.

## 1. Credentials

In the [Supabase Dashboard](https://supabase.com/dashboard):

1. Select your project
2. **Settings** (gear) → **API**
3. Copy **Project URL** → `VITE_SUPABASE_URL` and `SUPABASE_URL`
4. Copy **anon public** key → `VITE_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY`
5. Copy **service_role** key (secret) → `SUPABASE_SERVICE_ROLE_KEY` (server/scripts only)

```bash
cp .env.example .env
# Paste your values into .env (never commit .env)
```

## 2. Apply the schema

Open **SQL Editor** in Supabase and run **both** migration files in order:

1. `supabase/migrations/20260709000000_initial_schema.sql`
2. `supabase/migrations/20260709000001_grant_authenticated.sql`

If you already applied the initial schema before grants were added, you only need to run the second file.

This creates:

| Table | Maps from localStorage / types |
|-------|--------------------------------|
| `trial_progress` | `creatorexec-trial-progress` |
| `retainer_deals` | `creatorexec-brand-deals` (`BrandDeal`) |
| `income_entries` | `creatorexec-income-tracker` |
| `sprint_history` | sprint snapshots + recap (`SprintSnapshot`, `SprintReview`) |
| `product_scout_list` | `creatorexec-product-scout` |
| `onboarding_state` | `creatorexec-onboarding` + welcome/sprint-entry flags |

All tables have **RLS enabled** with per-user policies (`auth.uid() = user_id`).

The grants migration gives `authenticated` and `anon` the table privileges PostgREST needs. Without it, inserts fail with `permission denied for table ...` even when RLS policies are correct.

## 3. Test reads/writes + RLS

```bash
npm run test:supabase
```

The test script:

- Creates two temporary auth users (service role)
- Signs in as each with the anon key
- Inserts sample rows for every table as user A
- Confirms user B cannot read user A's data
- Deletes test users on completion

Local proof (no Supabase credentials): `npm run test:supabase:local`

## 4. App client (Phase 2+)

```ts
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabase/client'
```

Phase 2 wires **Supabase Auth** (email/password signup, login, logout, password reset). Phase 3 migrates feature data from localStorage to Supabase tables tied to the logged-in user.

### Auth redirect URLs (Supabase Dashboard → Authentication → URL Configuration)

Add your site URLs, including:

- `http://localhost:5173/reset-password` (local dev)
- `https://creatorexec.app/reset-password` (production)

Site URL can be `http://localhost:5173` for dev or your production domain.

### Verify auth

```bash
npm run test:auth
```

This creates a temporary user, confirms it appears in Authentication → Users, tests login/session/logout, then deletes the user.

## 5. Phase 3 — user data in Supabase

Apply the sprint snapshot migration if you set up Phase 1 before Phase 3 shipped:

3. `supabase/migrations/20260709000002_onboarding_sprint_snapshots.sql`

On first login after updating the app, any existing browser `localStorage` data for the six domains is uploaded once to Supabase under that user's account. After migration, reads and writes go to Supabase (not localStorage).

### Verify Phase 3 data layer

```bash
npm run test:phase3
```

The script:

- Creates a fresh auth user and confirms RLS-scoped writes/reads
- Simulates pre-login `localStorage` data and one-time migration (no duplicates on re-run)
- Signs in again as the same user in a new session (cross-device read)
- Prints actual table row JSON via the service role as proof

Phase 1 does **not** change unrelated localStorage modules (filming progress, angle rotation, Product Scout walkthrough flag).

-- Stripe subscription state per auth user (updated by webhook handler)

create type public.subscription_status as enum (
  'none',
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused'
);

create table public.user_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status public.subscription_status not null default 'none',
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index user_subscriptions_stripe_customer_id_idx
  on public.user_subscriptions (stripe_customer_id);

create index user_subscriptions_stripe_subscription_id_idx
  on public.user_subscriptions (stripe_subscription_id);

create trigger user_subscriptions_set_updated_at
before update on public.user_subscriptions
for each row execute function public.set_updated_at();

alter table public.user_subscriptions enable row level security;

create policy "user_subscriptions_select_own"
  on public.user_subscriptions for select
  using (auth.uid() = user_id);

-- Inserts/updates are performed by the Stripe webhook using the service role.

grant select on table public.user_subscriptions to anon, authenticated;
grant all on table public.user_subscriptions to service_role;

grant usage on type public.subscription_status to anon, authenticated, service_role;

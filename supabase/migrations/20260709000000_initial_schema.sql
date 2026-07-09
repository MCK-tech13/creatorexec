-- CreatorExec Phase 1: initial schema + row level security
-- Maps localStorage domains to Postgres tables (auth.users via Supabase Auth in Phase 2).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (aligned with src/types)
-- ---------------------------------------------------------------------------

create type public.deal_stage as enum (
  'negotiating',
  'contract_sent',
  'sample_otw',
  'filming',
  'posted',
  'awaiting_payment',
  'paid_closed'
);

create type public.deal_type as enum ('video', 'live', 'bundle');

create type public.trial_progress_source as enum ('manual', 'sales-history');

create type public.user_mode as enum ('beginner', 'advanced');

create type public.monthly_commission_level as enum (
  'just_starting',
  'growing',
  'established'
);

create type public.filming_approach as enum (
  'whatever_samples',
  'rough_system',
  'solid_system'
);

create type public.schedule_mode as enum ('full', 'sample', 'momentum');

create type public.product_scout_verdict as enum ('strong', 'test', 'pass');

create type public.tier_label as enum ('Anchor', 'Rising', 'Test', 'Cut');

-- ---------------------------------------------------------------------------
-- Shared trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- trial_progress  (creatorexec-trial-progress)
-- ---------------------------------------------------------------------------

create table public.trial_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  videos_filmed integer not null default 0 check (videos_filmed >= 0),
  source public.trial_progress_source,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, product_id)
);

create index trial_progress_user_id_idx on public.trial_progress (user_id);

create trigger trial_progress_set_updated_at
before update on public.trial_progress
for each row execute function public.set_updated_at();

alter table public.trial_progress enable row level security;

create policy "trial_progress_select_own"
  on public.trial_progress for select
  using (auth.uid() = user_id);

create policy "trial_progress_insert_own"
  on public.trial_progress for insert
  with check (auth.uid() = user_id);

create policy "trial_progress_update_own"
  on public.trial_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "trial_progress_delete_own"
  on public.trial_progress for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- retainer_deals  (creatorexec-brand-deals / BrandDeal)
-- ---------------------------------------------------------------------------

create table public.retainer_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_name text not null,
  product text not null default '',
  stage public.deal_stage not null default 'negotiating',
  deal_type public.deal_type,
  compensation numeric(12, 2),
  commission_percent numeric(5, 2),
  videos_required integer check (videos_required is null or videos_required >= 0),
  deadline_date date,
  contract_signed boolean not null default false,
  notes text,
  video_deliverables jsonb not null default '[]'::jsonb,
  is_retainer boolean not null default false,
  retainer_total_videos integer check (retainer_total_videos is null or retainer_total_videos >= 0),
  retainer_deadline_date date,
  filming_checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index retainer_deals_user_id_idx on public.retainer_deals (user_id);
create index retainer_deals_stage_idx on public.retainer_deals (user_id, stage);

create trigger retainer_deals_set_updated_at
before update on public.retainer_deals
for each row execute function public.set_updated_at();

alter table public.retainer_deals enable row level security;

create policy "retainer_deals_select_own"
  on public.retainer_deals for select
  using (auth.uid() = user_id);

create policy "retainer_deals_insert_own"
  on public.retainer_deals for insert
  with check (auth.uid() = user_id);

create policy "retainer_deals_update_own"
  on public.retainer_deals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "retainer_deals_delete_own"
  on public.retainer_deals for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- income_entries  (creatorexec-income-tracker)
-- ---------------------------------------------------------------------------

create table public.income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  gmv_total numeric(14, 2) not null default 0,
  estimated_commission numeric(14, 2) not null default 0,
  settled_commission numeric(14, 2) not null default 0,
  brand_deals_income numeric(14, 2) not null default 0,
  bonuses_rewards numeric(14, 2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, month_key)
);

create index income_entries_user_id_idx on public.income_entries (user_id);

create trigger income_entries_set_updated_at
before update on public.income_entries
for each row execute function public.set_updated_at();

alter table public.income_entries enable row level security;

create policy "income_entries_select_own"
  on public.income_entries for select
  using (auth.uid() = user_id);

create policy "income_entries_insert_own"
  on public.income_entries for insert
  with check (auth.uid() = user_id);

create policy "income_entries_update_own"
  on public.income_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "income_entries_delete_own"
  on public.income_entries for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- sprint_history  (sprint snapshots + recap / SprintReview)
-- ---------------------------------------------------------------------------

create table public.sprint_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz,
  ended_at timestamptz not null default timezone('utc', now()),
  file_name text,
  schedule_mode public.schedule_mode not null default 'full',
  videos_per_day integer not null check (videos_per_day > 0),
  sprint_days integer not null check (sprint_days in (3, 7, 14)),
  start_total_commission numeric(14, 2),
  end_total_commission numeric(14, 2) not null default 0,
  commission_delta numeric(14, 2),
  commission_percent_change numeric(8, 2),
  start_snapshot jsonb,
  end_snapshot jsonb not null default '{"products":[]}'::jsonb,
  tier_movements jsonb not null default '[]'::jsonb,
  trial_completions jsonb not null default '[]'::jsonb,
  top_performer jsonb,
  trials_in_progress integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index sprint_history_user_id_idx on public.sprint_history (user_id, ended_at desc);

alter table public.sprint_history enable row level security;

create policy "sprint_history_select_own"
  on public.sprint_history for select
  using (auth.uid() = user_id);

create policy "sprint_history_insert_own"
  on public.sprint_history for insert
  with check (auth.uid() = user_id);

create policy "sprint_history_update_own"
  on public.sprint_history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sprint_history_delete_own"
  on public.sprint_history for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- product_scout_list  (creatorexec-product-scout)
-- ---------------------------------------------------------------------------

create table public.product_scout_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_name text not null,
  metrics jsonb not null default '{}'::jsonb,
  verdict public.product_scout_verdict,
  total_score numeric(6, 2),
  funnel_recommendation jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index product_scout_list_user_id_idx on public.product_scout_list (user_id);

create trigger product_scout_list_set_updated_at
before update on public.product_scout_list
for each row execute function public.set_updated_at();

alter table public.product_scout_list enable row level security;

create policy "product_scout_list_select_own"
  on public.product_scout_list for select
  using (auth.uid() = user_id);

create policy "product_scout_list_insert_own"
  on public.product_scout_list for insert
  with check (auth.uid() = user_id);

create policy "product_scout_list_update_own"
  on public.product_scout_list for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "product_scout_list_delete_own"
  on public.product_scout_list for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- onboarding_state  (creatorexec-onboarding + UI flags)
-- ---------------------------------------------------------------------------

create table public.onboarding_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  completed boolean not null default false,
  mode public.user_mode,
  videos_per_day integer check (videos_per_day is null or videos_per_day > 0),
  monthly_commission public.monthly_commission_level,
  filming_approach public.filming_approach,
  welcome_seen boolean not null default false,
  sprint_entry_seen boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger onboarding_state_set_updated_at
before update on public.onboarding_state
for each row execute function public.set_updated_at();

alter table public.onboarding_state enable row level security;

create policy "onboarding_state_select_own"
  on public.onboarding_state for select
  using (auth.uid() = user_id);

create policy "onboarding_state_insert_own"
  on public.onboarding_state for insert
  with check (auth.uid() = user_id);

create policy "onboarding_state_update_own"
  on public.onboarding_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "onboarding_state_delete_own"
  on public.onboarding_state for delete
  using (auth.uid() = user_id);

-- Privileges for Supabase API roles (see also 20260709000001_grant_authenticated.sql)
grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role;

grant select, insert, update, delete on table public.trial_progress to anon, authenticated;
grant select, insert, update, delete on table public.retainer_deals to anon, authenticated;
grant select, insert, update, delete on table public.income_entries to anon, authenticated;
grant select, insert, update, delete on table public.sprint_history to anon, authenticated;
grant select, insert, update, delete on table public.product_scout_list to anon, authenticated;
grant select, insert, update, delete on table public.onboarding_state to anon, authenticated;

grant usage on type public.deal_stage to anon, authenticated;
grant usage on type public.deal_type to anon, authenticated;
grant usage on type public.trial_progress_source to anon, authenticated;
grant usage on type public.user_mode to anon, authenticated;
grant usage on type public.monthly_commission_level to anon, authenticated;
grant usage on type public.filming_approach to anon, authenticated;
grant usage on type public.schedule_mode to anon, authenticated;
grant usage on type public.product_scout_verdict to anon, authenticated;
grant usage on type public.tier_label to anon, authenticated;

alter default privileges in schema public
  grant all on tables to postgres, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

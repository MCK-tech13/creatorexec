-- Manual product linking: multiple TikTok IDs → one catalog row + undo history.

alter table public.user_products
  add column if not exists linked_external_ids jsonb not null default '[]'::jsonb;

comment on column public.user_products.linked_external_ids is
  'Extra TikTok product IDs manually linked to this catalog row (JSON string array).';

create table if not exists public.catalog_merge_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  survivor_id uuid not null,
  survivor_display_name text not null,
  absorbed_ids jsonb not null default '[]'::jsonb,
  before_products jsonb not null default '[]'::jsonb,
  before_trial jsonb not null default '{}'::jsonb,
  after_trial_videos_filmed integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  undone_at timestamptz
);

create index if not exists catalog_merge_history_user_id_idx
  on public.catalog_merge_history (user_id, created_at desc);

alter table public.catalog_merge_history enable row level security;

create policy "catalog_merge_history_select_own"
  on public.catalog_merge_history for select
  using (auth.uid() = user_id);

create policy "catalog_merge_history_insert_own"
  on public.catalog_merge_history for insert
  with check (auth.uid() = user_id);

create policy "catalog_merge_history_update_own"
  on public.catalog_merge_history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "catalog_merge_history_delete_own"
  on public.catalog_merge_history for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.catalog_merge_history to anon, authenticated;
grant all on table public.catalog_merge_history to service_role;

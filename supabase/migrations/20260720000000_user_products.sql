-- Durable product catalog (survives current_sprint_state clears / new-sprint resets).
-- Distinct from current_sprint_state.products JSON (live sprint workspace only).

create type public.catalog_product_source as enum (
  'csv',
  'manual',
  'sample',
  'backfill'
);

create table public.user_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  brand text,
  external_product_id text,
  source public.catalog_product_source not null default 'manual',
  is_favorite boolean not null default false,
  gmv numeric not null default 0,
  commission numeric not null default 0,
  items_sold integer not null default 0 check (items_sold >= 0),
  order_count integer not null default 0 check (order_count >= 0),
  in_rotation boolean not null default true,
  is_manual boolean not null default false,
  date_received date,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index user_products_user_id_idx on public.user_products (user_id);
create index user_products_user_external_product_id_idx
  on public.user_products (user_id, external_product_id)
  where external_product_id is not null;

create trigger user_products_set_updated_at
before update on public.user_products
for each row execute function public.set_updated_at();

alter table public.user_products enable row level security;

create policy "user_products_select_own"
  on public.user_products for select
  using (auth.uid() = user_id);

create policy "user_products_insert_own"
  on public.user_products for insert
  with check (auth.uid() = user_id);

create policy "user_products_update_own"
  on public.user_products for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_products_delete_own"
  on public.user_products for delete
  using (auth.uid() = user_id);

grant usage on type public.catalog_product_source to anon, authenticated;
grant select, insert, update, delete on table public.user_products to anon, authenticated;

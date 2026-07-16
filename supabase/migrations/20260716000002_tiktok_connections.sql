-- TikTok Login Kit connections (tokens server-side only; clients read public profile fields).

create table public.tiktok_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  open_id text not null,
  display_name text,
  avatar_url text,
  scope text,
  access_token text not null,
  refresh_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  connected_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index tiktok_connections_open_id_idx on public.tiktok_connections (open_id);

create trigger tiktok_connections_set_updated_at
before update on public.tiktok_connections
for each row execute function public.set_updated_at();

alter table public.tiktok_connections enable row level security;

-- Clients may read their own connection metadata. Prefer API that never returns tokens.
create policy "tiktok_connections_select_own"
  on public.tiktok_connections for select
  using (auth.uid() = user_id);

grant select on table public.tiktok_connections to authenticated;
grant all on table public.tiktok_connections to service_role;

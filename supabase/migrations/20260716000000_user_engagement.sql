-- Engagement signals for upload reminders (email + in-app banner).
-- Distinct from current_sprint_state so clears/resets don't wipe reminder history.

create table public.user_engagement (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_csv_upload_at timestamptz,
  last_upload_reminder_sent_at timestamptz,
  upload_reminder_dismissed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger user_engagement_set_updated_at
before update on public.user_engagement
for each row execute function public.set_updated_at();

alter table public.user_engagement enable row level security;

create policy "user_engagement_select_own"
  on public.user_engagement for select
  using (auth.uid() = user_id);

create policy "user_engagement_insert_own"
  on public.user_engagement for insert
  with check (auth.uid() = user_id);

create policy "user_engagement_update_own"
  on public.user_engagement for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.user_engagement to anon, authenticated;
grant all on table public.user_engagement to service_role;

-- Approximate prior uploads so existing beta users aren't stuck with null forever.
insert into public.user_engagement (user_id, last_csv_upload_at)
select cs.user_id, cs.updated_at
from public.current_sprint_state cs
where cs.file_name is not null
on conflict (user_id) do update
  set last_csv_upload_at = coalesce(
    public.user_engagement.last_csv_upload_at,
    excluded.last_csv_upload_at
  );

insert into public.user_engagement (user_id, last_csv_upload_at)
select distinct on (sh.user_id) sh.user_id, sh.ended_at
from public.sprint_history sh
where sh.file_name is not null
order by sh.user_id, sh.ended_at desc
on conflict (user_id) do update
  set last_csv_upload_at = greatest(
    coalesce(public.user_engagement.last_csv_upload_at, excluded.last_csv_upload_at),
    excluded.last_csv_upload_at
  );

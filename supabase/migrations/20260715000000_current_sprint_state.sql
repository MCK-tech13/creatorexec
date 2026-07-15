-- Live current-sprint workspace (products, schedule, filming checkmarks).
-- One row per user. Distinct from sprint_history (completed archives) and
-- onboarding_state.sprint_*_snapshot (end-of-sprint review summaries).

create table public.current_sprint_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stage text not null,
  schedule_mode public.schedule_mode not null default 'full',
  file_name text,
  sprint_config jsonb not null default '{"videosPerDay":5,"sprintDays":7}'::jsonb,
  products jsonb not null default '[]'::jsonb,
  deadline_products jsonb not null default '[]'::jsonb,
  excluded_product_keys text[] not null default '{}'::text[],
  sample_products jsonb not null default '[]'::jsonb,
  schedule jsonb not null default '[]'::jsonb,
  filming_progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint current_sprint_state_stage_check check (
    stage in ('upload', 'sample', 'momentum', 'dashboard', 'config', 'schedule')
  ),
  constraint current_sprint_state_sprint_config_object check (jsonb_typeof(sprint_config) = 'object'),
  constraint current_sprint_state_products_array check (jsonb_typeof(products) = 'array'),
  constraint current_sprint_state_deadline_products_array check (jsonb_typeof(deadline_products) = 'array'),
  constraint current_sprint_state_sample_products_array check (jsonb_typeof(sample_products) = 'array'),
  constraint current_sprint_state_schedule_array check (jsonb_typeof(schedule) = 'array'),
  constraint current_sprint_state_filming_progress_object check (jsonb_typeof(filming_progress) = 'object')
);

create trigger current_sprint_state_set_updated_at
before update on public.current_sprint_state
for each row execute function public.set_updated_at();

alter table public.current_sprint_state enable row level security;

create policy "current_sprint_state_select_own"
  on public.current_sprint_state for select
  using (auth.uid() = user_id);

create policy "current_sprint_state_insert_own"
  on public.current_sprint_state for insert
  with check (auth.uid() = user_id);

create policy "current_sprint_state_update_own"
  on public.current_sprint_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "current_sprint_state_delete_own"
  on public.current_sprint_state for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on table public.current_sprint_state to anon, authenticated;

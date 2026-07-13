-- Add source + note to income_entries and allow multiple entries per month.

alter table public.income_entries
  add column if not exists source text not null default 'TikTok Shop',
  add column if not exists note text;

alter table public.income_entries
  alter column source set default 'TikTok Shop';

update public.income_entries
set
  source = 'TikTok Shop',
  note = null
where source is null;

alter table public.income_entries
  drop constraint if exists income_entries_user_id_month_key_key;

alter table public.income_entries
  add constraint income_entries_source_check
  check (
    source in (
      'TikTok Shop',
      'Meta Commission',
      'Trybe Commission',
      'Other'
    )
  );

create index if not exists income_entries_user_month_idx
  on public.income_entries (user_id, month_key);

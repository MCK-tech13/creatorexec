-- Add Amazon Commission as a valid income_entries.source value.

alter table public.income_entries
  drop constraint if exists income_entries_source_check;

alter table public.income_entries
  add constraint income_entries_source_check
  check (
    source in (
      'TikTok Shop',
      'Meta Commission',
      'Trybe Commission',
      'Amazon Commission',
      'Other'
    )
  );

-- Track which Product Scout scoring rules produced total_score / verdict.
-- Null on legacy rows saved before this column existed.

alter table public.product_scout_list
  add column if not exists scoring_logic_version integer;

comment on column public.product_scout_list.scoring_logic_version is
  'Integer version of Product Scout scoring rules used when total_score/verdict were written. Null = pre-versioning.';

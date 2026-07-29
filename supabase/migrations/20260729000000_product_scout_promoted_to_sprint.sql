-- Link Product Scout entries to sprint catalog rows after "Add to Sprint".
-- Soft reference (no FK): if the catalog row is removed, app clears the mark.

alter table public.product_scout_list
  add column if not exists promoted_catalog_product_id uuid;

alter table public.product_scout_list
  add column if not exists promoted_at timestamptz;

comment on column public.product_scout_list.promoted_catalog_product_id is
  'user_products.id created when this Scout entry was added to the sprint catalog. Null = not promoted.';

comment on column public.product_scout_list.promoted_at is
  'When this Scout entry was promoted to the sprint catalog. Null = not promoted.';

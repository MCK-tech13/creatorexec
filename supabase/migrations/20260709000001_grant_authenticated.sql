-- CreatorExec Phase 1: table privileges for Supabase API roles
-- RLS policies alone are not enough — PostgREST connects as `authenticated` / `anon`
-- and still needs explicit GRANTs on tables, enums, and schema usage.

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

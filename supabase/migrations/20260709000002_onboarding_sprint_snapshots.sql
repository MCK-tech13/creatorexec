-- Phase 3: persist in-progress sprint snapshots per user (replaces localStorage keys)

alter table public.onboarding_state
  add column if not exists sprint_start_snapshot jsonb,
  add column if not exists sprint_previous_snapshot jsonb;

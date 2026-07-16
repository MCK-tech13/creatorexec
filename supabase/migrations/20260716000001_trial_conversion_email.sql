-- Track trial→paid conversion email so invoice.paid retries / renewals don't re-send.

alter table public.user_subscriptions
  add column if not exists trial_conversion_email_sent_at timestamptz;

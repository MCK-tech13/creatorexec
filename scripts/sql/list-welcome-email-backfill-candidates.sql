-- Dry-run list for welcome-email backfill (Supabase SQL Editor).
-- ALL currently active/trialing subscribers (no date cutoff).
-- Mirror of exclusion heuristics in scripts/backfill-welcome-emails.mjs

SELECT
  u.email,
  s.subscription_status,
  s.created_at AS subscription_created_at,
  u.created_at AS auth_created_at,
  s.user_id,
  s.stripe_subscription_id,
  s.price_id
FROM public.user_subscriptions s
JOIN auth.users u ON u.id = s.user_id
WHERE s.subscription_status IN ('active', 'trialing')
  AND u.email IS NOT NULL
  AND lower(u.email) <> 'mckcreativegroup@gmail.com'
  AND lower(split_part(u.email, '@', 2)) NOT IN ('example.com', 'test.com')
  AND lower(split_part(u.email, '@', 1)) NOT LIKE 'creatorexec-stripe-%'
  AND lower(split_part(u.email, '@', 1)) NOT LIKE 'creatorexec-auth-%'
  AND lower(split_part(u.email, '@', 1)) NOT LIKE 'creatorexec-billing-%'
  AND lower(split_part(u.email, '@', 1)) NOT LIKE 'creatorexec-phase3-%'
  AND lower(split_part(u.email, '@', 1)) !~ '\+(test|livetest|welcometest|prod[0-9]*|qa|sandbox|internal)(\+|$)'
  AND position('+test' in lower(split_part(u.email, '@', 1))) = 0
  AND position('+livetest' in lower(split_part(u.email, '@', 1))) = 0
  AND position('+welcometest' in lower(split_part(u.email, '@', 1))) = 0
  AND position('+prod' in lower(split_part(u.email, '@', 1))) = 0
ORDER BY u.email;

-- Optional TikTok sample post deadline — applies to the first trial video only.
-- Remaining videos 2–6 stay normal Test trial slots (no deadline pressure).

alter table public.user_products
  add column if not exists first_video_deadline date;

-- Run this in Supabase SQL Editor.

alter table orders add column if not exists items jsonb;
alter table orders add column if not exists telegram_user_id text;
alter table orders add column if not exists telegram_username text;
alter table orders add column if not exists telegram_first_name text;

-- Status can now also be 'delivered' (in addition to pending/confirmed/rejected).
-- No schema change needed for that since status is a free-text column.

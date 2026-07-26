-- Run this in Supabase SQL Editor.

alter table orders add column if not exists telegram_contact text;

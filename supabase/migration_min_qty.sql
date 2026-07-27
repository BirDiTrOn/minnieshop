-- Run this in Supabase SQL Editor.

alter table items add column if not exists min_qty numeric not null default 1;

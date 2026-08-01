-- Run this in Supabase SQL Editor.

alter table items add column if not exists category text;

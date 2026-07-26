-- Run this in Supabase SQL Editor. Safe to run even if you already ran
-- migration_units.sql — this only adds one new column.

alter table items add column if not exists stock numeric;

-- stock = NULL means "unlimited / not tracked" (the default, matches old items).
-- Set a number to start tracking remaining stock for that listing.

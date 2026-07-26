-- Run this in Supabase SQL Editor (your existing tables are safe — this only adds new columns).

alter table items add column if not exists pricing_mode text not null default 'fixed';
alter table items add column if not exists unit_label text;
alter table items add column if not exists unit_amount numeric;

alter table orders add column if not exists qty integer not null default 1;
alter table orders add column if not exists total_price numeric;

-- Backfill total_price for any existing orders so nothing shows blank.
update orders set total_price = price where total_price is null;

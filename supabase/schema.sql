-- Run this once in your Supabase project's SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  game text not null default 'other',
  game_label text not null default 'Other game',
  price numeric not null,
  currency text not null default 'USD',
  pricing_mode text not null default 'fixed',
  unit_label text,
  unit_amount numeric,
  min_qty numeric not null default 1,
  stock numeric,
  tiers jsonb,
  position integer not null default 0,
  description text,
  image text,
  sold boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete set null,
  item_name text,
  price numeric,
  currency text,
  qty integer not null default 1,
  total_price numeric,
  buyer_contact text,
  telegram_contact text,
  telegram_user_id text,
  telegram_username text,
  telegram_first_name text,
  items jsonb,
  payment_proof text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Row Level Security is enabled with NO policies for the anon/authenticated
-- roles. This app never uses the public anon key — every request goes
-- through server-side API routes using the service role key, which
-- bypasses RLS. This keeps your data closed to direct public access.
alter table items enable row level security;
alter table orders enable row level security;

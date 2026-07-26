-- Run this once in your Supabase project's SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  game text not null default 'other',
  game_label text not null default 'Other game',
  price numeric not null,
  currency text not null default 'USD',
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
  buyer_contact text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Row Level Security is enabled with NO policies for the anon/authenticated
-- roles. This app never uses the public anon key — every request goes
-- through server-side API routes using the service role key, which
-- bypasses RLS. This keeps your data closed to direct public access.
alter table items enable row level security;
alter table orders enable row level security;

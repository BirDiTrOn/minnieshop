-- Run this in Supabase SQL Editor.

alter table items add column if not exists position integer;

-- Backfill existing rows using their creation order so nothing jumps around.
with ordered as (
  select id, row_number() over (order by created_at asc) as rn
  from items
)
update items
set position = ordered.rn
from ordered
where items.id = ordered.id and items.position is null;

alter table items alter column position set default 0;

-- Run this in Supabase SQL Editor.

alter table items add column if not exists tiers jsonb;

-- tiers looks like: [{"minQty": 1000, "pricePerUnit": 0.0065}, {"minQty": 5000, "pricePerUnit": 0.006}]
-- meaning: once a buyer's quantity reaches minQty, that tier's price-per-pack applies
-- instead of the item's normal price. NULL/empty means no bulk pricing (default behavior).

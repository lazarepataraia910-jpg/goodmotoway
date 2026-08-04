-- GoodMotoway: add color variants to products
-- Run this once in the Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to run even if the column already exists.

alter table public.products
  add column if not exists colors jsonb not null default '[]'::jsonb;

-- Shape of each entry in `colors`:
-- { "hex": "#D8253B", "name": "წითელი", "images": ["https://.../product-images/img-....jpg", ...] }

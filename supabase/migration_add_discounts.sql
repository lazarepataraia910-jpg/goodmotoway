-- GoodMotoway: time-limited sale prices per product
-- Run this once in the Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run: every statement checks before it creates.

create table if not exists public.discounts (
  id          bigint generated always as identity primary key,
  product_id  bigint not null references public.products(id) on delete cascade,
  sale_price  numeric not null check (sale_price > 0),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint discounts_window_check check (ends_at > starts_at)
);

create index if not exists discounts_product_idx on public.discounts (product_id);
create index if not exists discounts_ends_at_idx on public.discounts (ends_at);

alter table public.discounts enable row level security;

-- the catalogue has to read sale prices for every visitor
drop policy if exists "discounts_read_all" on public.discounts;
create policy "discounts_read_all"
  on public.discounts for select
  to anon, authenticated
  using (true);

-- only the admin account may create, edit or remove them
drop policy if exists "discounts_admin_write" on public.discounts;
create policy "discounts_admin_write"
  on public.discounts for all
  to authenticated
  using (lower(auth.jwt() ->> 'email') = 'lazarepataraia910@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'lazarepataraia910@gmail.com');

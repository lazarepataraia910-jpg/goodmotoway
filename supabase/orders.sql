-- GoodMotoway: orders table + RLS
-- Run this once in the Supabase Dashboard -> SQL Editor -> New query -> Run.
-- The AI agent does not have access to your Supabase project and cannot run this for you.

create table if not exists public.orders (
  id               bigint generated always as identity primary key,
  order_code       text not null unique,
  created_at       timestamptz not null default now(),
  user_id          uuid references auth.users(id) on delete set null,
  product_id       bigint references public.products(id) on delete set null,
  product_name     text not null,
  product_color    text,
  unit_price       numeric not null default 0,
  quantity         integer not null default 1 check (quantity between 1 and 20),
  total            numeric not null default 0,
  fulfilment       text not null check (fulfilment in ('pickup','delivery')),
  pickup_date      date not null,
  pickup_time      text not null,
  address          text,
  customer_name    text not null,
  customer_phone   text not null,
  note             text,
  status           text not null default 'new'
                   check (status in ('new','confirmed','done','cancelled'))
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_user_id_idx    on public.orders (user_id);

alter table public.orders enable row level security;

-- anyone (guest or signed in) may place an order
create policy "orders_insert_anyone"
  on public.orders for insert
  to anon, authenticated
  with check (true);

-- a signed-in user sees only their own orders
create policy "orders_select_own"
  on public.orders for select
  to authenticated
  using (user_id = auth.uid());

-- a signed-in user may cancel their own order while it is still new
create policy "orders_cancel_own"
  on public.orders for update
  to authenticated
  using (user_id = auth.uid() and status = 'new')
  with check (user_id = auth.uid() and status = 'cancelled');

-- admin sees and manages everything
-- (lower(...) matches the case-insensitive email check already used in
-- migration_lock_admin_writes.sql for the products table)
create policy "orders_admin_all"
  on public.orders for all
  to authenticated
  using (lower(auth.jwt() ->> 'email') = 'lazarepataraia910@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'lazarepataraia910@gmail.com');

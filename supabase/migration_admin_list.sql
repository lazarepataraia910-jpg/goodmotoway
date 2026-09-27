-- GoodMotoway: admins as a list instead of one hardcoded email
-- Run this once in the Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Every admin policy (products, product images, orders, discounts) now asks
-- public.is_admin() instead of repeating the email. To add or remove an admin
-- later, edit the list below and run just the "create or replace function"
-- statement again; the policies pick it up without being recreated.
--
-- Keep the list in step with ADMIN_EMAILS in admin.html, admin-orders.html,
-- admin-discounts.html, admin-stats.html and api/stats.js, which decide who
-- gets past the admin pages' sign-in screen.

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(lower(auth.jwt() ->> 'email'), '') in (
    'lazarepataraia910@gmail.com',
    'aka.molashkhia2@gmail.com'
  );
$$;

-- products
drop policy if exists "Admin insert access" on public.products;
drop policy if exists "Admin update access" on public.products;
drop policy if exists "Admin delete access" on public.products;

create policy "Admin insert access" on public.products
  for insert with check (public.is_admin());

create policy "Admin update access" on public.products
  for update using (public.is_admin())
  with check (public.is_admin());

create policy "Admin delete access" on public.products
  for delete using (public.is_admin());

-- product images
drop policy if exists "Admin upload product images" on storage.objects;
drop policy if exists "Admin delete product images" on storage.objects;

create policy "Admin upload product images" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin());

create policy "Admin delete product images" on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());

-- orders
drop policy if exists "orders_admin_all" on public.orders;

create policy "orders_admin_all"
  on public.orders for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- discounts
drop policy if exists "discounts_admin_write" on public.discounts;

create policy "discounts_admin_write"
  on public.discounts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

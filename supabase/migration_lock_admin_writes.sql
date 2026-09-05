-- GoodMotoway: lock product writes down to the admin account only
-- Run this once in the Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- Background: schema.sql originally left insert/update/delete on `products`
-- (and uploads/deletes on the product-images bucket) open to anyone with the
-- anon key, with the admin gate enforced only client-side in admin.html by a
-- hardcoded password. That password was visible to anyone who viewed the
-- page source, and even without it, anyone could write directly to the
-- REST API. This migration replaces the "open" policies with policies that
-- require a signed-in Supabase Auth session belonging to the admin email,
-- matching the Google-sign-in gate now used in admin.html.

-- Change this if the admin account's email changes.
-- (Postgres doesn't support parameters in DDL, so it's inlined per policy below.)

drop policy if exists "Public insert access" on public.products;
drop policy if exists "Public update access" on public.products;
drop policy if exists "Public delete access" on public.products;

create policy "Admin insert access" on public.products
  for insert with check (lower(auth.jwt() ->> 'email') = 'lazarepataraia910@gmail.com');

create policy "Admin update access" on public.products
  for update using (lower(auth.jwt() ->> 'email') = 'lazarepataraia910@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'lazarepataraia910@gmail.com');

create policy "Admin delete access" on public.products
  for delete using (lower(auth.jwt() ->> 'email') = 'lazarepataraia910@gmail.com');

-- Public read access is unchanged (site visitors still browse products freely).

drop policy if exists "Public upload product images" on storage.objects;
drop policy if exists "Public delete product images" on storage.objects;

create policy "Admin upload product images" on storage.objects
  for insert with check (
    bucket_id = 'product-images'
    and lower(auth.jwt() ->> 'email') = 'lazarepataraia910@gmail.com'
  );

create policy "Admin delete product images" on storage.objects
  for delete using (
    bucket_id = 'product-images'
    and lower(auth.jwt() ->> 'email') = 'lazarepataraia910@gmail.com'
  );

-- Public read access to product images is unchanged.

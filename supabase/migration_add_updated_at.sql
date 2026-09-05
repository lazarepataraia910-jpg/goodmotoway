-- GoodMotoway: track when a product was last edited, shown on product.html
-- Run this once in the Supabase Dashboard -> SQL Editor -> New query -> Run

alter table public.products add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_products_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_products_updated_at();

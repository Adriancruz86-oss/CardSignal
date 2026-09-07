alter table public.sealed_products
  add column if not exists best_offer_price numeric,
  add column if not exists best_offer_shipping numeric,
  add column if not exists best_offer_url text,
  add column if not exists best_offer_source text,
  add column if not exists best_offer_seller text,
  add column if not exists best_offer_checked_at timestamptz;

create index if not exists sealed_products_best_offer_idx
  on public.sealed_products(user_id, best_offer_checked_at desc);

-- Adds product artwork metadata for sealed market cards.

alter table public.sealed_products
  add column if not exists image_url text,
  add column if not exists image_source text,
  add column if not exists last_scanned_at timestamptz;

create index if not exists sealed_products_scan_queue_idx
  on public.sealed_products(last_scanned_at asc nulls first, updated_at asc);

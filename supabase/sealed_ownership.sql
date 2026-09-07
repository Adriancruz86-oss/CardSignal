-- CardSignal sealed ownership / cost-basis lots.
create table if not exists public.sealed_position_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sealed_product_id uuid not null references public.sealed_products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  unit_cost numeric not null check (unit_cost >= 0),
  purchased_at date,
  retailer text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sealed_position_lots_user_idx on public.sealed_position_lots(user_id, created_at desc);
create index if not exists sealed_position_lots_product_idx on public.sealed_position_lots(sealed_product_id, created_at desc);

alter table public.sealed_position_lots enable row level security;
drop policy if exists "sealed_position_lots_own_rows" on public.sealed_position_lots;
create policy "sealed_position_lots_own_rows" on public.sealed_position_lots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

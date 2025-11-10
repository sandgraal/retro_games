-- Migration: price snapshot storage for PriceCharting integration
-- Generated: 2025-03-15T14:00:00Z

begin;

create table if not exists public.game_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  game_key text not null,
  game_name text not null,
  platform text not null,
  product_id text,
  product_name text,
  console_name text,
  currency text not null default 'USD',
  loose_price_cents integer,
  cib_price_cents integer,
  new_price_cents integer,
  source text not null default 'pricecharting',
  snapshot_date date not null default current_date,
  fetched_at timestamptz not null default now(),
  metadata jsonb,
  constraint game_price_snapshot_unique unique (game_key, source, snapshot_date)
);

create index if not exists game_price_snapshots_game_key_idx on public.game_price_snapshots (game_key);
create index if not exists game_price_snapshots_product_idx on public.game_price_snapshots (product_id);
create index if not exists game_price_snapshots_snapshot_idx on public.game_price_snapshots (snapshot_date);

create or replace view public.game_price_latest as
select distinct on (game_key, source)
  id,
  game_key,
  game_name,
  platform,
  product_id,
  product_name,
  console_name,
  currency,
  loose_price_cents,
  cib_price_cents,
  new_price_cents,
  source,
  snapshot_date,
  fetched_at,
  metadata
from public.game_price_snapshots
order by game_key, source, snapshot_date desc, fetched_at desc;

alter table public.game_price_snapshots enable row level security;
create policy if not exists "read price snapshots" on public.game_price_snapshots for select using (true);
create policy if not exists "service snapshot inserts" on public.game_price_snapshots
  for insert with check (auth.role() = 'service_role');
create policy if not exists "service snapshot deletes" on public.game_price_snapshots
  for delete using (auth.role() = 'service_role');

grant select on table public.game_price_snapshots to anon, authenticated;
grant select on public.game_price_latest to anon, authenticated;

grant insert, delete on table public.game_price_snapshots to service_role;

commit;

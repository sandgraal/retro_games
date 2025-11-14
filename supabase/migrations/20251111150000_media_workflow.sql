-- Migration: media storage workflow and regional pricing support
-- Generated: 2025-11-11T15:00:00Z

begin;

-- Ensure storage buckets exist for public covers, authenticated media, archive, and pending uploads.
insert into storage.buckets (id, name, public)
values
  ('game-covers', 'game-covers', true),
  ('media-auth', 'media-auth', false),
  ('media-archive', 'media-archive', false),
  ('media-pending', 'media-pending', false)
on conflict (id) do update set name = excluded.name, public = excluded.public;

-- Create role for content moderators if it does not exist.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'content_moderator') then
    create role content_moderator;
  end if;
end;
$$;

-- Extend game_media with storage metadata and regional targeting.
alter table public.game_media
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists source_label text,
  add column if not exists checksum text,
  add column if not exists region_code text,
  add column if not exists is_primary boolean default false;

create index if not exists game_media_bucket_path_idx on public.game_media (storage_bucket, storage_path);
create index if not exists game_media_region_idx on public.game_media (region_code);

-- Queue for community submissions awaiting moderation.
create table if not exists public.pending_media (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  game_key text not null,
  title text not null,
  platform text not null,
  region_code text,
  asset_type text not null,
  original_filename text,
  content_type text,
  byte_size integer,
  storage_bucket text,
  storage_path text,
  checksum text,
  source_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by text,
  notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_id text,
  review_notes text
);

create index if not exists pending_media_status_idx on public.pending_media (status);
create index if not exists pending_media_game_key_idx on public.pending_media (game_key);

alter table public.pending_media enable row level security;

create policy if not exists "submit pending media" on public.pending_media
  for insert
  with check (status = 'pending');

create policy if not exists "moderators view pending media" on public.pending_media
  for select using (
    coalesce(current_setting('request.jwt.claim.role', true), '') in ('service_role', 'content_moderator')
  );

create policy if not exists "moderators update pending media" on public.pending_media
  for update using (
    coalesce(current_setting('request.jwt.claim.role', true), '') in ('service_role', 'content_moderator')
  );

create policy if not exists "service delete pending media" on public.pending_media
  for delete using (
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

grant insert on public.pending_media to anon, authenticated;
grant select, update on public.pending_media to content_moderator;
grant select, insert, update, delete on public.pending_media to service_role;

-- Allow service and moderators to manage approved media records.
create policy if not exists "manage game media" on public.game_media
  for insert with check (
    coalesce(current_setting('request.jwt.claim.role', true), '') in ('service_role', 'content_moderator')
  );

create policy if not exists "update game media" on public.game_media
  for update using (
    coalesce(current_setting('request.jwt.claim.role', true), '') in ('service_role', 'content_moderator')
  ) with check (
    coalesce(current_setting('request.jwt.claim.role', true), '') in ('service_role', 'content_moderator')
  );

create policy if not exists "delete game media" on public.game_media
  for delete using (
    coalesce(current_setting('request.jwt.claim.role', true), '') in ('service_role', 'content_moderator')
  );

grant insert, update, delete on public.game_media to content_moderator, service_role;

-- Regional variant pricing table and deltas view.
create table if not exists public.game_variant_prices (
  id uuid primary key default gen_random_uuid(),
  game_key text not null,
  region_code text not null,
  currency text not null default 'USD',
  loose_price_cents integer,
  cib_price_cents integer,
  new_price_cents integer,
  source text not null default 'pricecharting',
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_variant_price_unique unique (game_key, region_code, source)
);

create index if not exists game_variant_prices_game_region_idx on public.game_variant_prices (game_key, region_code);

alter table public.game_variant_prices enable row level security;

create policy if not exists "read variant prices" on public.game_variant_prices for select using (true);

create policy if not exists "service upsert variant prices" on public.game_variant_prices
  for insert with check (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role');

create policy if not exists "service update variant prices" on public.game_variant_prices
  for update using (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role')
  with check (coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role');

grant select on public.game_variant_prices to anon, authenticated;
grant insert, update on public.game_variant_prices to service_role;

-- Extend price snapshots with region metadata and refresh latest view.
alter table public.game_price_snapshots
  add column if not exists region_code text default 'NTSC';

create index if not exists game_price_snapshots_region_idx on public.game_price_snapshots (region_code);

create or replace view public.game_price_latest as
select distinct on (game_key, source, region_code)
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
  region_code,
  snapshot_date,
  fetched_at,
  metadata
from public.game_price_snapshots
order by game_key, source, region_code, snapshot_date desc, fetched_at desc;

grant select on public.game_price_latest to anon, authenticated;

-- The baseline region for price deltas is now configurable via the function parameter.
-- If a game does not have a variant in the baseline region, delta columns will be null.
-- This design allows flexibility for PAL-exclusive titles or other regional variants
-- that may not have an NTSC counterpart. The default baseline remains 'NTSC' for
-- backward compatibility, but callers can specify alternative regions as needed.
drop view if exists public.game_variant_price_deltas;
create or replace function public.game_variant_price_deltas(baseline_region text default 'NTSC')
returns table (
  game_key text,
  region_code text,
  currency text,
  loose_price_cents integer,
  cib_price_cents integer,
  new_price_cents integer,
  source text,
  snapshot_date date,
  base_loose_price_cents integer,
  base_cib_price_cents integer,
  base_new_price_cents integer,
  loose_delta_percent numeric,
  cib_delta_percent numeric,
  new_delta_percent numeric
) as $$
  select
    v.game_key,
    v.region_code,
    v.currency,
    v.loose_price_cents,
    v.cib_price_cents,
    v.new_price_cents,
    v.source,
    v.snapshot_date,
    base.loose_price_cents as base_loose_price_cents,
    base.cib_price_cents as base_cib_price_cents,
    base.new_price_cents as base_new_price_cents,
    case
      when base.loose_price_cents is null or base.loose_price_cents = 0 or v.loose_price_cents is null then null
      else round(((v.loose_price_cents - base.loose_price_cents)::numeric / base.loose_price_cents) * 100, 2)
    end as loose_delta_percent,
    case
      when base.cib_price_cents is null or base.cib_price_cents = 0 or v.cib_price_cents is null then null
      else round(((v.cib_price_cents - base.cib_price_cents)::numeric / base.cib_price_cents) * 100, 2)
    end as cib_delta_percent,
    case
      when base.new_price_cents is null or base.new_price_cents = 0 or v.new_price_cents is null then null
      else round(((v.new_price_cents - base.new_price_cents)::numeric / base.new_price_cents) * 100, 2)
    end as new_delta_percent
  from public.game_variant_prices v
  left join public.game_price_latest base
    on base.game_key = v.game_key and base.source = v.source and base.region_code = baseline_region;
$$ language sql stable;

grant execute on function public.game_variant_price_deltas(text) to anon, authenticated;

-- Storage object policies for the new buckets.
alter table storage.objects enable row level security;

create policy if not exists "public read covers" on storage.objects
  for select using (bucket_id = 'game-covers');

create policy if not exists "upload pending media" on storage.objects
  for insert with check (
    bucket_id = 'media-pending' and
    coalesce(current_setting('request.jwt.claim.role', true), '') in ('', 'anon', 'authenticated')
  );

create policy if not exists "moderator manage media" on storage.objects
  for update using (
    bucket_id in ('media-pending', 'game-covers', 'media-auth', 'media-archive') and
    coalesce(current_setting('request.jwt.claim.role', true), '') in ('service_role', 'content_moderator')
  )
  with check (
    bucket_id in ('media-pending', 'game-covers', 'media-auth', 'media-archive') and
    coalesce(current_setting('request.jwt.claim.role', true), '') in ('service_role', 'content_moderator')
  );

create policy if not exists "moderator read secure media" on storage.objects
  for select using (
    bucket_id in ('media-pending', 'media-auth', 'media-archive') and
    coalesce(current_setting('request.jwt.claim.role', true), '') in ('service_role', 'content_moderator')
  );

create policy if not exists "service delete media" on storage.objects
  for delete using (
    bucket_id in ('media-pending', 'game-covers', 'media-auth', 'media-archive') and
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

commit;

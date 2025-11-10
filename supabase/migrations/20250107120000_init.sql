-- Migration: create normalized schema for retro games hub
-- Generated: 2025-01-07T12:00:00Z


begin;

create extension if not exists "pgcrypto"; -- for gen_random_uuid

-- Ensure the auth schema/function exist so policies referencing auth.uid() succeed
create schema if not exists auth;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'uid'
      and n.nspname = 'auth'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    execute $$
      create function auth.uid()
      returns uuid
      language sql
      stable
      as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
    $$;
  end if;
end;
$$;

create table if not exists public.platforms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  manufacturer text,
  release_year int,
  created_at timestamptz not null default now()
);

create table if not exists public.genres (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform_id uuid references public.platforms(id) on delete set null,
  rating numeric(4,2),
  rating_category text,
  release_year int,
  player_mode text,
  region text,
  notes text,
  player_count text,
  cover_url text,
  details_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_genres (
  game_id uuid references public.games(id) on delete cascade,
  genre_id uuid references public.genres(id) on delete cascade,
  primary key (game_id, genre_id)
);

create table if not exists public.game_media (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete cascade,
  media_url text not null,
  media_type text default 'image',
  created_at timestamptz not null default now()
);

-- Local-only status/notes currently live in the client; schema prepared for future multi-user rollout.
create table if not exists public.user_game_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  game_id uuid references public.games(id) on delete cascade,
  status text default 'none',
  note text,
  updated_at timestamptz not null default now()
);

-- Row Level Security policies
alter table public.platforms enable row level security;
create policy "public read platforms" on public.platforms for select using (true);

alter table public.genres enable row level security;
create policy "public read genres" on public.genres for select using (true);

alter table public.games enable row level security;
create policy "public read games" on public.games for select using (true);

alter table public.game_genres enable row level security;
create policy "public read game_genres" on public.game_genres for select using (true);

alter table public.game_media enable row level security;
create policy "public read game_media" on public.game_media for select using (true);

alter table public.user_game_notes enable row level security;
create policy "users read their notes" on public.user_game_notes for select using (auth.uid() = user_id);
create policy "users write their notes" on public.user_game_notes for insert with check (auth.uid() = user_id);
create policy "users update their notes" on public.user_game_notes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;

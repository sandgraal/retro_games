-- Migration: create normalized schema for retro games hub
-- Generated: 2025-01-07T12:00:00Z


begin;

create extension if not exists "pgcrypto"; -- for gen_random_uuid

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

commit;

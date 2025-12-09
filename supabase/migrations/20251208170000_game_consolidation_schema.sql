-- Game Consolidation Schema Migration (CI-safe rewrite)
-- Applied: December 2025
-- Purpose: Consolidate duplicate games and create regional variant tracking
--
-- This version is rewritten to work against the normalized local schema used in CI:
-- - public.games.id is uuid (not bigint)
-- - column names are normalized (name, rating_category, cover_url, details_url)
-- - platform is referenced via platform_id (uuid)
--
-- NEW TABLES:
-- - game_variants: Stores regional/version variants linked to canonical games
--
-- ENHANCED COLUMNS ON games TABLE:
-- - description, developer, publisher, esrb_rating, metacritic_score, igdb_id
-- - is_canonical: Boolean flag (true = show in UI, false = variant/duplicate)
-- - canonical_id: Foreign key to the canonical version of this game
-- - updated_at: Timestamp for change tracking
--
-- NEW VIEW:
-- - games_consolidated: Shows canonical games with variant counts
--   Includes: variant_count, available_regions[] for UI display

-- ============================================================================
-- PART 1: Create game_variants table and types
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE variant_type AS ENUM ('official', 'translation', 'revision', 'special_edition');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE region_code AS ENUM ('NTSC-U', 'NTSC-J', 'PAL', 'NTSC-K', 'NTSC-C', 'WORLD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.game_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  region region_code NOT NULL DEFAULT 'WORLD',
  variant_type variant_type NOT NULL DEFAULT 'official',
  local_title text,
  release_date date,
  publisher text,
  product_code text,
  cover_url text,
  notes text,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT game_variant_unique UNIQUE (game_id, region, variant_type)
);

CREATE INDEX IF NOT EXISTS game_variants_game_id_idx ON public.game_variants (game_id);
CREATE INDEX IF NOT EXISTS game_variants_region_idx ON public.game_variants (region);
CREATE INDEX IF NOT EXISTS game_variants_primary_idx ON public.game_variants (game_id) WHERE is_primary = true;

ALTER TABLE public.game_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read game variants" ON public.game_variants
  FOR SELECT USING (true);

CREATE POLICY "manage game variants" ON public.game_variants
  FOR ALL USING (
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  ) WITH CHECK (
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

GRANT SELECT ON public.game_variants TO anon, authenticated;
GRANT ALL ON public.game_variants TO service_role;

-- ============================================================================
-- PART 2: Enhance games table with new columns
-- ============================================================================

ALTER TABLE public.games 
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS developer text,
  ADD COLUMN IF NOT EXISTS publisher text,
  ADD COLUMN IF NOT EXISTS esrb_rating text,
  ADD COLUMN IF NOT EXISTS metacritic_score integer,
  ADD COLUMN IF NOT EXISTS igdb_id integer,
  ADD COLUMN IF NOT EXISTS is_canonical boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS canonical_id uuid REFERENCES public.games(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS games_canonical_idx ON public.games (is_canonical) WHERE is_canonical = true;
CREATE INDEX IF NOT EXISTS games_igdb_id_idx ON public.games (igdb_id) WHERE igdb_id IS NOT NULL;

-- ============================================================================
-- PART 3: Create consolidated view for frontend
-- ============================================================================

CREATE OR REPLACE VIEW public.games_consolidated AS
SELECT 
  g.id,
  g.name AS game_name,
  p.name AS platform_name,
  p.slug AS platform_slug,
  g.rating,
  g.rating_category AS rating_cat,
  g.release_year,
  g.player_mode,
  g.region,
  g.notes,
  g.player_count,
  g.cover_url AS cover,
  g.details_url,
  g.description,
  g.developer,
  g.publisher,
  g.esrb_rating,
  g.metacritic_score,
  g.igdb_id,
  g.updated_at,
  COALESCE(v.variant_count, 0) as variant_count,
  COALESCE(v.available_regions, ARRAY[]::text[]) as available_regions
FROM public.games g
LEFT JOIN public.platforms p ON p.id = g.platform_id
LEFT JOIN (
  SELECT 
    game_id,
    COUNT(*) as variant_count,
    array_agg(DISTINCT region::text ORDER BY region::text) as available_regions
  FROM public.game_variants
  GROUP BY game_id
) v ON g.id = v.game_id
WHERE g.is_canonical = true OR g.is_canonical IS NULL;

GRANT SELECT ON public.games_consolidated TO anon, authenticated;

-- ============================================================================
-- PART 4: Helper function to get game with variants
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_game_with_variants(p_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'game', row_to_json(g.*),
    'variants', COALESCE(
      (SELECT jsonb_agg(row_to_json(v.*))
       FROM game_variants v
       WHERE v.game_id = p_game_id),
      '[]'::jsonb
    )
  ) INTO result
  FROM games g
  WHERE g.id = p_game_id;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_game_with_variants(uuid) TO anon, authenticated;

-- ============================================================================
-- DATA MIGRATION (applied separately, documented here for reference)
-- ============================================================================
-- 
-- 1. Marked 57 exact duplicates (same name, same platform) as non-canonical
-- 2. Linked regional variants (Europe, Japan, USA etc.) to canonical base games
-- 3. Created 278 variant entries in game_variants table
-- 4. Marked N/A platform games as non-canonical (incomplete data)
-- 
-- Result: 161 canonical games with proper variant tracking

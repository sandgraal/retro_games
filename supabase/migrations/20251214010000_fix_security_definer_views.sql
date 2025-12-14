-- Migration: Fix SECURITY DEFINER views
-- Created: 2024-12-14
-- Description: Recreate views with security_invoker = true to use calling user's permissions
--              instead of view definer's permissions (better security practice)

-- Recreate games_with_variants view without SECURITY DEFINER
DROP VIEW IF EXISTS public.games_with_variants;

CREATE VIEW public.games_with_variants 
WITH (security_invoker = true)
AS
SELECT 
  gv.id AS variant_id,
  g.id AS game_id,
  g.game_name,
  g.genre,
  g.rating,
  g.rating_cat,
  g.release_year,
  g.player_mode,
  g.player_count,
  g.description,
  g.developer,
  g.publisher,
  g.esrb_rating,
  g.metacritic_score,
  g.igdb_id,
  gv.platform,
  gv.region,
  gv.variant_type,
  gv.local_title,
  gv.release_date AS variant_release_date,
  gv.publisher AS variant_publisher,
  gv.product_code,
  COALESCE(gv.cover_url, g.cover) AS cover,
  gv.notes AS variant_notes,
  gv.is_primary,
  gv.metadata AS variant_metadata,
  GREATEST(g.updated_at, gv.updated_at) AS updated_at
FROM games g
JOIN game_variants gv ON gv.game_id = g.id
WHERE gv.platform IS NOT NULL;

-- Recreate games_consolidated view without SECURITY DEFINER
DROP VIEW IF EXISTS public.games_consolidated;

CREATE VIEW public.games_consolidated
WITH (security_invoker = true)
AS
SELECT 
  g.id,
  g.game_name,
  g.genre,
  g.rating,
  g.rating_cat,
  g.release_year,
  g.player_mode,
  g.player_count,
  g.description,
  g.developer,
  g.publisher,
  g.esrb_rating,
  g.metacritic_score,
  g.igdb_id,
  g.cover,
  g.updated_at,
  ARRAY_AGG(DISTINCT gv.platform ORDER BY gv.platform) FILTER (WHERE gv.platform IS NOT NULL) as platforms
FROM games g
LEFT JOIN game_variants gv ON gv.game_id = g.id
GROUP BY g.id, g.game_name, g.genre, g.rating, g.rating_cat, g.release_year, 
         g.player_mode, g.player_count, g.description, g.developer, g.publisher,
         g.esrb_rating, g.metacritic_score, g.igdb_id, g.cover, g.updated_at;

-- Grant SELECT permissions to anon and authenticated users
GRANT SELECT ON public.games_with_variants TO anon, authenticated;
GRANT SELECT ON public.games_consolidated TO anon, authenticated;

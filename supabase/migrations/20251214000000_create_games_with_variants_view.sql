-- Migration: Create games_with_variants view
-- Created: December 2025
-- Purpose: Denormalized view joining games with their platform variants for the frontend

-- Drop existing view if it exists (for idempotency)
DROP VIEW IF EXISTS games_with_variants;

-- Create the denormalized view
-- Each row represents one game+platform combination (variant)
CREATE VIEW games_with_variants AS
SELECT 
  -- Variant ID as the primary identifier
  gv.id AS variant_id,
  -- Core game data
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
  -- Variant-specific data
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
  -- Timestamps
  GREATEST(g.updated_at, gv.updated_at) AS updated_at
FROM games g
INNER JOIN game_variants gv ON gv.game_id = g.id
WHERE gv.platform IS NOT NULL;

-- Create index hint comment for query optimization
COMMENT ON VIEW games_with_variants IS 
  'Denormalized view of games with their platform variants. 
   Use for frontend display where each card represents a game+platform combo.
   Filter by platform, genre, release_year etc.
   ORDER BY game_name for alphabetical listing.';

-- Grant read access to anon role
GRANT SELECT ON games_with_variants TO anon;
GRANT SELECT ON games_with_variants TO authenticated;

-- =====================================================
-- Update games_consolidated to include platforms array
-- =====================================================
DROP VIEW IF EXISTS games_consolidated;

CREATE VIEW games_consolidated AS
SELECT 
  g.id,
  g.game_name,
  -- Aggregate platforms into an array instead of single null platform
  ARRAY_AGG(DISTINCT gv.platform ORDER BY gv.platform) FILTER (WHERE gv.platform IS NOT NULL) AS platforms,
  -- Keep single platform field for backward compatibility (first/primary platform)
  (SELECT gv2.platform 
   FROM game_variants gv2 
   WHERE gv2.game_id = g.id AND gv2.is_primary = true 
   LIMIT 1) AS platform,
  g.rating,
  g.rating_cat,
  g.genre,
  g.release_year,
  g.player_mode,
  g.region,
  g.notes,
  g.player_count,
  g.cover,
  g.description,
  g.developer,
  g.publisher,
  g.esrb_rating,
  g.metacritic_score,
  g.igdb_id,
  g.updated_at,
  COUNT(gv.id) AS variant_count,
  ARRAY_AGG(DISTINCT gv.region ORDER BY gv.region) FILTER (WHERE gv.region IS NOT NULL) AS available_regions
FROM games g
LEFT JOIN game_variants gv ON gv.game_id = g.id
GROUP BY g.id;

COMMENT ON VIEW games_consolidated IS 
  'Consolidated view of games with aggregated variant data.
   Each row = one game with platforms array and variant count.
   Use for game-centric views (not collection tracking).';

-- Grant read access
GRANT SELECT ON games_consolidated TO anon;
GRANT SELECT ON games_consolidated TO authenticated;

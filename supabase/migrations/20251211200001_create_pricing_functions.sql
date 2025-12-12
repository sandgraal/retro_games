-- Migration: Pricing Helper Functions and Views
-- Purpose: Create functions for price analysis, user reputation, and marketplace operations
-- Created: December 2025

-- =====================================================
-- PRICE HISTORY FUNCTION
-- Get price history for a game over time
-- =====================================================
CREATE OR REPLACE FUNCTION get_price_history(
  p_game_key text,
  p_days integer DEFAULT 365,
  p_region_code text DEFAULT 'NTSC'
)
RETURNS TABLE (
  snapshot_date date,
  loose_price_cents integer,
  cib_price_cents integer,
  new_price_cents integer,
  source text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gps.snapshot_date,
    gps.loose_price_cents,
    gps.cib_price_cents,
    gps.new_price_cents,
    gps.source
  FROM game_price_snapshots gps
  WHERE gps.game_key = p_game_key
    AND gps.region_code = p_region_code
    AND gps.snapshot_date >= CURRENT_DATE - p_days
  ORDER BY gps.snapshot_date ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- PRICE TREND ANALYSIS
-- Calculate price changes over different periods
-- =====================================================
CREATE OR REPLACE FUNCTION get_price_trends(p_game_key text)
RETURNS TABLE (
  game_key text,
  current_loose integer,
  current_cib integer,
  current_new integer,
  week_change_pct numeric,
  month_change_pct numeric,
  quarter_change_pct numeric,
  year_change_pct numeric,
  all_time_low_loose integer,
  all_time_high_loose integer,
  snapshot_count integer
) AS $$
DECLARE
  v_current record;
  v_week_ago integer;
  v_month_ago integer;
  v_quarter_ago integer;
  v_year_ago integer;
  v_atl integer;
  v_ath integer;
  v_count integer;
BEGIN
  -- Get current price
  SELECT gps.loose_price_cents, gps.cib_price_cents, gps.new_price_cents
  INTO v_current
  FROM game_price_snapshots gps
  WHERE gps.game_key = p_game_key
  ORDER BY gps.snapshot_date DESC
  LIMIT 1;
  
  IF v_current IS NULL THEN
    RETURN;
  END IF;
  
  -- Get historical prices
  SELECT gps.loose_price_cents INTO v_week_ago
  FROM game_price_snapshots gps
  WHERE gps.game_key = p_game_key AND gps.snapshot_date <= CURRENT_DATE - 7
  ORDER BY gps.snapshot_date DESC LIMIT 1;
  
  SELECT gps.loose_price_cents INTO v_month_ago
  FROM game_price_snapshots gps
  WHERE gps.game_key = p_game_key AND gps.snapshot_date <= CURRENT_DATE - 30
  ORDER BY gps.snapshot_date DESC LIMIT 1;
  
  SELECT gps.loose_price_cents INTO v_quarter_ago
  FROM game_price_snapshots gps
  WHERE gps.game_key = p_game_key AND gps.snapshot_date <= CURRENT_DATE - 90
  ORDER BY gps.snapshot_date DESC LIMIT 1;
  
  SELECT gps.loose_price_cents INTO v_year_ago
  FROM game_price_snapshots gps
  WHERE gps.game_key = p_game_key AND gps.snapshot_date <= CURRENT_DATE - 365
  ORDER BY gps.snapshot_date DESC LIMIT 1;
  
  -- Get all-time stats
  SELECT MIN(gps.loose_price_cents), MAX(gps.loose_price_cents), COUNT(*)::integer
  INTO v_atl, v_ath, v_count
  FROM game_price_snapshots gps
  WHERE gps.game_key = p_game_key AND gps.loose_price_cents IS NOT NULL;
  
  RETURN QUERY
  SELECT
    p_game_key,
    v_current.loose_price_cents,
    v_current.cib_price_cents,
    v_current.new_price_cents,
    CASE WHEN v_week_ago > 0 THEN ROUND(((v_current.loose_price_cents - v_week_ago)::numeric / v_week_ago) * 100, 2) END,
    CASE WHEN v_month_ago > 0 THEN ROUND(((v_current.loose_price_cents - v_month_ago)::numeric / v_month_ago) * 100, 2) END,
    CASE WHEN v_quarter_ago > 0 THEN ROUND(((v_current.loose_price_cents - v_quarter_ago)::numeric / v_quarter_ago) * 100, 2) END,
    CASE WHEN v_year_ago > 0 THEN ROUND(((v_current.loose_price_cents - v_year_ago)::numeric / v_year_ago) * 100, 2) END,
    v_atl,
    v_ath,
    v_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- USER REPUTATION VIEW
-- Aggregate user ratings for reputation display
-- =====================================================
CREATE OR REPLACE VIEW user_reputation AS
SELECT
  p.id AS user_id,
  p.display_name,
  p.avatar_url,
  COUNT(DISTINCT ur.id) AS total_ratings,
  ROUND(AVG(ur.overall_rating), 2) AS avg_overall,
  ROUND(AVG(ur.communication_rating), 2) AS avg_communication,
  ROUND(AVG(ur.shipping_rating), 2) AS avg_shipping,
  ROUND(AVG(ur.accuracy_rating), 2) AS avg_accuracy,
  COUNT(DISTINCT CASE WHEN ur.overall_rating >= 4 THEN ur.id END) AS positive_count,
  COUNT(DISTINCT CASE WHEN ur.overall_rating = 3 THEN ur.id END) AS neutral_count,
  COUNT(DISTINCT CASE WHEN ur.overall_rating < 3 THEN ur.id END) AS negative_count,
  COUNT(DISTINCT ut.id) AS total_transactions,
  COUNT(DISTINCT ul.id) FILTER (WHERE ul.status = 'sold') AS items_sold,
  MIN(ut.created_at) AS member_since_transaction
FROM profiles p
LEFT JOIN user_ratings ur ON ur.rated_id = p.id
LEFT JOIN user_transactions ut ON ut.seller_id = p.id OR ut.buyer_id = p.id
LEFT JOIN user_listings ul ON ul.user_id = p.id
GROUP BY p.id, p.display_name, p.avatar_url;

-- =====================================================
-- ACTIVE LISTINGS BY GAME
-- Quick lookup of available listings for a game
-- =====================================================
CREATE OR REPLACE FUNCTION get_game_listings(
  p_game_key text,
  p_listing_type listing_type DEFAULT NULL,
  p_max_price_cents integer DEFAULT NULL,
  p_conditions item_condition[] DEFAULT NULL
)
RETURNS TABLE (
  listing_id uuid,
  user_id uuid,
  seller_name text,
  seller_rating numeric,
  listing_type listing_type,
  title text,
  condition item_condition,
  asking_price_cents integer,
  is_price_negotiable boolean,
  is_complete_in_box boolean,
  country_code text,
  region text,
  photo_count integer,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ul.id,
    ul.user_id,
    p.display_name,
    (SELECT ROUND(AVG(ur.overall_rating), 1) FROM user_ratings ur WHERE ur.rated_id = ul.user_id),
    ul.listing_type,
    ul.title,
    ul.condition,
    ul.asking_price_cents,
    ul.is_price_negotiable,
    ul.is_complete_in_box,
    ul.country_code,
    ul.region,
    jsonb_array_length(ul.photos)::integer,
    ul.created_at
  FROM user_listings ul
  LEFT JOIN profiles p ON p.id = ul.user_id
  WHERE ul.game_key = p_game_key
    AND ul.status = 'active'
    AND (p_listing_type IS NULL OR ul.listing_type = p_listing_type)
    AND (p_max_price_cents IS NULL OR ul.asking_price_cents <= p_max_price_cents)
    AND (p_conditions IS NULL OR ul.condition = ANY(p_conditions))
  ORDER BY ul.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- CHECK PRICE ALERTS
-- Function to check if any alerts should be triggered
-- Returns alerts that match current prices or listings
-- =====================================================
CREATE OR REPLACE FUNCTION check_price_alerts()
RETURNS TABLE (
  alert_id uuid,
  user_id uuid,
  game_key text,
  game_name text,
  alert_type alert_type,
  target_price_cents integer,
  current_price_cents integer,
  triggered_by text -- 'market' or 'listing'
) AS $$
BEGIN
  RETURN QUERY
  -- Check against market prices
  SELECT
    upa.id AS alert_id,
    upa.user_id,
    upa.game_key,
    upa.game_name,
    upa.alert_type,
    upa.target_price_cents,
    gpl.loose_price_cents AS current_price_cents,
    'market'::text AS triggered_by
  FROM user_price_alerts upa
  JOIN game_price_latest gpl ON gpl.game_key = upa.game_key
  WHERE upa.status = 'active'
    AND upa.include_market_prices = true
    AND upa.target_price_cents >= gpl.loose_price_cents
    
  UNION ALL
  
  -- Check against user listings
  SELECT
    upa.id AS alert_id,
    upa.user_id,
    upa.game_key,
    upa.game_name,
    upa.alert_type,
    upa.target_price_cents,
    MIN(ul.asking_price_cents) AS current_price_cents,
    'listing'::text AS triggered_by
  FROM user_price_alerts upa
  JOIN user_listings ul ON ul.game_key = upa.game_key
  WHERE upa.status = 'active'
    AND upa.include_user_listings = true
    AND ul.status = 'active'
    AND ul.asking_price_cents <= upa.target_price_cents
    AND (upa.condition_filter IS NULL OR ul.condition = ANY(upa.condition_filter))
  GROUP BY upa.id, upa.user_id, upa.game_key, upa.game_name, upa.alert_type, upa.target_price_cents;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- TRADE MATCHING
-- Find potential trade matches for a user's listings
-- =====================================================
CREATE OR REPLACE FUNCTION find_trade_matches(p_user_id uuid)
RETURNS TABLE (
  my_listing_id uuid,
  my_game_key text,
  my_game_name text,
  their_listing_id uuid,
  their_game_key text,
  their_game_name text,
  their_user_id uuid,
  their_username text,
  match_type text -- 'direct' (they want what I have and vice versa) or 'one_way'
) AS $$
BEGIN
  RETURN QUERY
  -- Find direct matches: I want their game AND they want my game
  SELECT
    my.id AS my_listing_id,
    my.game_key AS my_game_key,
    g1.game_name AS my_game_name,
    their.id AS their_listing_id,
    their.game_key AS their_game_key,
    g2.game_name AS their_game_name,
    their.user_id AS their_user_id,
    p.display_name AS their_username,
    'direct'::text AS match_type
  FROM user_listings my
  JOIN user_listings their ON their.user_id != my.user_id
  LEFT JOIN games g1 ON g1.id = my.game_id
  LEFT JOIN games g2 ON g2.id = their.game_id
  LEFT JOIN profiles p ON p.id = their.user_id
  WHERE my.user_id = p_user_id
    AND my.listing_type IN ('trade', 'sale')
    AND my.status = 'active'
    AND their.listing_type IN ('trade', 'sale')
    AND their.status = 'active'
    -- They want what I have
    AND their.trade_preferences ? my.game_key
    -- I want what they have
    AND my.trade_preferences ? their.game_key

  UNION ALL

  -- Find one-way matches: they want what I have
  SELECT
    my.id AS my_listing_id,
    my.game_key AS my_game_key,
    g1.game_name AS my_game_name,
    their.id AS their_listing_id,
    their.game_key AS their_game_key,
    g2.game_name AS their_game_name,
    their.user_id AS their_user_id,
    p.display_name AS their_username,
    'one_way'::text AS match_type
  FROM user_listings my
  JOIN user_listings their ON their.user_id != my.user_id
  LEFT JOIN games g1 ON g1.id = my.game_id
  LEFT JOIN games g2 ON g2.id = their.game_id
  LEFT JOIN profiles p ON p.id = their.user_id
  WHERE my.user_id = p_user_id
    AND my.listing_type IN ('trade', 'sale')
    AND my.status = 'active'
    AND their.listing_type = 'wanted'
    AND their.status = 'active'
    AND their.game_key = my.game_key;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- MARKETPLACE STATS VIEW
-- Dashboard statistics for marketplace health
-- =====================================================
CREATE OR REPLACE VIEW marketplace_stats AS
SELECT
  (SELECT COUNT(*) FROM user_listings WHERE status = 'active') AS active_listings,
  (SELECT COUNT(*) FROM user_listings WHERE status = 'active' AND listing_type = 'sale') AS for_sale,
  (SELECT COUNT(*) FROM user_listings WHERE status = 'active' AND listing_type = 'trade') AS for_trade,
  (SELECT COUNT(*) FROM user_listings WHERE status = 'active' AND listing_type = 'wanted') AS wanted,
  (SELECT COUNT(*) FROM user_transactions WHERE status = 'completed' AND created_at > CURRENT_DATE - 30) AS transactions_30d,
  (SELECT COALESCE(SUM(total_cents), 0) FROM user_transactions WHERE status = 'completed' AND created_at > CURRENT_DATE - 30) AS volume_30d_cents,
  (SELECT COUNT(DISTINCT user_id) FROM user_listings WHERE status = 'active') AS active_sellers,
  (SELECT COUNT(*) FROM trade_offers WHERE status = 'pending') AS pending_trades,
  (SELECT COUNT(*) FROM game_price_snapshots WHERE snapshot_date = CURRENT_DATE) AS prices_updated_today;

-- =====================================================
-- PRICE COMPARISON VIEW
-- Compare user listings to market prices
-- =====================================================
CREATE OR REPLACE VIEW listing_price_comparison AS
SELECT
  ul.id AS listing_id,
  ul.game_key,
  ul.title,
  ul.condition,
  ul.asking_price_cents,
  gpl.loose_price_cents AS market_loose_cents,
  gpl.cib_price_cents AS market_cib_cents,
  CASE ul.condition
    WHEN 'new' THEN gpl.new_price_cents
    WHEN 'like_new' THEN gpl.new_price_cents
    ELSE CASE WHEN ul.is_complete_in_box THEN gpl.cib_price_cents ELSE gpl.loose_price_cents END
  END AS comparable_market_cents,
  CASE
    WHEN ul.asking_price_cents IS NULL THEN NULL
    WHEN gpl.loose_price_cents IS NULL THEN NULL
    ELSE ROUND(((ul.asking_price_cents::numeric / NULLIF(gpl.loose_price_cents, 0)) - 1) * 100, 1)
  END AS price_vs_market_pct,
  ul.user_id,
  ul.created_at
FROM user_listings ul
LEFT JOIN game_price_latest gpl ON gpl.game_key = ul.game_key
WHERE ul.status = 'active';

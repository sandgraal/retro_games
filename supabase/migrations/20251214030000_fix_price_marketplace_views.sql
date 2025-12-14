-- Migration: Fix remaining SECURITY DEFINER views
-- Created: 2024-12-14
-- Description: Recreate price and marketplace views with security_invoker = true

-- Recreate game_price_latest view with security_invoker
DROP VIEW IF EXISTS public.listing_price_comparison;
DROP VIEW IF EXISTS public.game_price_latest CASCADE;

CREATE VIEW public.game_price_latest 
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (game_key, region_code) 
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
  region_code,
  metadata
FROM game_price_snapshots
ORDER BY game_key, region_code, snapshot_date DESC, fetched_at DESC;

GRANT SELECT ON public.game_price_latest TO anon, authenticated;

-- Recreate game_price_trends view with security_invoker
DROP VIEW IF EXISTS public.game_price_trends;

CREATE VIEW public.game_price_trends
WITH (security_invoker = true)
AS
WITH latest_prices AS (
  SELECT DISTINCT ON (game_key) 
    game_key, game_name, platform,
    loose_price_cents, cib_price_cents, new_price_cents,
    snapshot_date, source, currency
  FROM game_price_snapshots
  ORDER BY game_key, snapshot_date DESC
),
week_ago AS (
  SELECT DISTINCT ON (game_key) 
    game_key, loose_price_cents AS week_ago_loose
  FROM game_price_snapshots
  WHERE snapshot_date <= (CURRENT_DATE - '7 days'::interval)
  ORDER BY game_key, snapshot_date DESC
),
month_ago AS (
  SELECT DISTINCT ON (game_key) 
    game_key, loose_price_cents AS month_ago_loose
  FROM game_price_snapshots
  WHERE snapshot_date <= (CURRENT_DATE - '30 days'::interval)
  ORDER BY game_key, snapshot_date DESC
),
price_extremes AS (
  SELECT game_key,
    min(loose_price_cents) AS all_time_low_loose,
    max(loose_price_cents) AS all_time_high_loose
  FROM game_price_snapshots
  WHERE loose_price_cents IS NOT NULL
  GROUP BY game_key
)
SELECT 
  l.game_key, l.game_name, l.platform,
  l.loose_price_cents, l.cib_price_cents, l.new_price_cents,
  l.snapshot_date, l.source, l.currency,
  CASE
    WHEN w.week_ago_loose > 0 AND l.loose_price_cents IS NOT NULL 
    THEN round(((l.loose_price_cents - w.week_ago_loose)::numeric / w.week_ago_loose::numeric) * 100, 2)
    ELSE NULL
  END AS week_change_pct,
  CASE
    WHEN m.month_ago_loose > 0 AND l.loose_price_cents IS NOT NULL 
    THEN round(((l.loose_price_cents - m.month_ago_loose)::numeric / m.month_ago_loose::numeric) * 100, 2)
    ELSE NULL
  END AS month_change_pct,
  e.all_time_low_loose,
  e.all_time_high_loose
FROM latest_prices l
LEFT JOIN week_ago w ON l.game_key = w.game_key
LEFT JOIN month_ago m ON l.game_key = m.game_key
LEFT JOIN price_extremes e ON l.game_key = e.game_key;

GRANT SELECT ON public.game_price_trends TO anon, authenticated;

-- Recreate listing_price_comparison view with security_invoker
CREATE VIEW public.listing_price_comparison
WITH (security_invoker = true)
AS
SELECT 
  ul.id AS listing_id,
  ul.game_key,
  ul.title,
  ul.condition,
  ul.asking_price_cents,
  gpl.loose_price_cents AS market_loose_cents,
  gpl.cib_price_cents AS market_cib_cents,
  CASE ul.condition
    WHEN 'new'::item_condition THEN gpl.new_price_cents
    WHEN 'like_new'::item_condition THEN gpl.new_price_cents
    ELSE
      CASE
        WHEN ul.is_complete_in_box THEN gpl.cib_price_cents
        ELSE gpl.loose_price_cents
      END
  END AS comparable_market_cents,
  CASE
    WHEN ul.asking_price_cents IS NULL THEN NULL
    WHEN gpl.loose_price_cents IS NULL THEN NULL
    ELSE round(((ul.asking_price_cents::numeric / NULLIF(gpl.loose_price_cents, 0)::numeric) - 1) * 100, 1)
  END AS price_vs_market_pct,
  ul.user_id,
  ul.created_at
FROM user_listings ul
LEFT JOIN game_price_latest gpl ON gpl.game_key = ul.game_key
WHERE ul.status = 'active'::listing_status;

GRANT SELECT ON public.listing_price_comparison TO anon, authenticated;

-- Recreate marketplace_stats view with security_invoker
DROP VIEW IF EXISTS public.marketplace_stats;

CREATE VIEW public.marketplace_stats
WITH (security_invoker = true)
AS
SELECT 
  (SELECT count(*) FROM user_listings WHERE status = 'active'::listing_status) AS active_listings,
  (SELECT count(*) FROM user_listings WHERE status = 'active'::listing_status AND listing_type = 'sale'::listing_type) AS for_sale,
  (SELECT count(*) FROM user_listings WHERE status = 'active'::listing_status AND listing_type = 'trade'::listing_type) AS for_trade,
  (SELECT count(*) FROM user_listings WHERE status = 'active'::listing_status AND listing_type = 'wanted'::listing_type) AS wanted,
  (SELECT count(*) FROM user_transactions WHERE status = 'completed'::transaction_status AND created_at > (CURRENT_DATE - 30)) AS transactions_30d,
  (SELECT COALESCE(sum(total_cents), 0) FROM user_transactions WHERE status = 'completed'::transaction_status AND created_at > (CURRENT_DATE - 30)) AS volume_30d_cents,
  (SELECT count(DISTINCT user_id) FROM user_listings WHERE status = 'active'::listing_status) AS active_sellers,
  (SELECT count(*) FROM trade_offers WHERE status = 'pending'::trade_status) AS pending_trades,
  (SELECT count(*) FROM game_price_snapshots WHERE snapshot_date = CURRENT_DATE) AS prices_updated_today;

GRANT SELECT ON public.marketplace_stats TO anon, authenticated;

-- Recreate user_reputation view with security_invoker
DROP VIEW IF EXISTS public.user_reputation;

CREATE VIEW public.user_reputation
WITH (security_invoker = true)
AS
SELECT 
  p.id AS user_id,
  p.display_name,
  p.avatar_url,
  count(DISTINCT ur.id) AS total_ratings,
  round(avg(ur.overall_rating), 2) AS avg_overall,
  round(avg(ur.communication_rating), 2) AS avg_communication,
  round(avg(ur.shipping_rating), 2) AS avg_shipping,
  round(avg(ur.accuracy_rating), 2) AS avg_accuracy,
  count(DISTINCT CASE WHEN ur.overall_rating >= 4 THEN ur.id END) AS positive_count,
  count(DISTINCT CASE WHEN ur.overall_rating = 3 THEN ur.id END) AS neutral_count,
  count(DISTINCT CASE WHEN ur.overall_rating < 3 THEN ur.id END) AS negative_count,
  count(DISTINCT ut.id) AS total_transactions,
  count(DISTINCT ul.id) FILTER (WHERE ul.status = 'sold'::listing_status) AS items_sold,
  min(ut.created_at) AS member_since_transaction
FROM profiles p
LEFT JOIN user_ratings ur ON ur.rated_id = p.id
LEFT JOIN user_transactions ut ON ut.seller_id = p.id OR ut.buyer_id = p.id
LEFT JOIN user_listings ul ON ul.user_id = p.id
GROUP BY p.id, p.display_name, p.avatar_url;

GRANT SELECT ON public.user_reputation TO authenticated;

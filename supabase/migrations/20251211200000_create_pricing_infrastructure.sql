-- Migration: Comprehensive Pricing Infrastructure
-- Purpose: Create tables for price snapshots, user listings, alerts, and trade system
-- Created: December 2025

-- =====================================================
-- GAME PRICE SNAPSHOTS TABLE
-- Stores historical pricing data from eBay and other sources
-- =====================================================
CREATE TABLE IF NOT EXISTS game_price_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_key text NOT NULL,
  game_name text NOT NULL,
  platform text NOT NULL,
  
  -- External product mapping
  product_id text,
  product_name text,
  console_name text,
  
  -- Pricing in cents (avoids floating point issues)
  currency text NOT NULL DEFAULT 'USD',
  loose_price_cents integer,
  cib_price_cents integer,
  new_price_cents integer,
  
  -- Source and timing
  source text NOT NULL DEFAULT 'ebay',
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  
  -- Regional and metadata
  region_code text DEFAULT 'NTSC',
  metadata jsonb DEFAULT '{}',
  
  -- Prevent duplicate snapshots per game/date/source
  CONSTRAINT unique_snapshot UNIQUE (game_key, snapshot_date, source, region_code)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_price_snapshots_game_key ON game_price_snapshots(game_key);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_date ON game_price_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_source ON game_price_snapshots(source);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_platform ON game_price_snapshots(platform);

-- =====================================================
-- GAME PRICE LATEST VIEW
-- View for quick access to latest prices per game
-- =====================================================
CREATE OR REPLACE VIEW game_price_latest AS
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

-- =====================================================
-- PRICE SOURCES ENUM AND TABLE
-- Track configured price data sources
-- =====================================================
DO $$ BEGIN
  CREATE TYPE price_source AS ENUM ('ebay', 'pricecharting', 'vgpc', 'user_listing', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS price_source_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source price_source NOT NULL UNIQUE,
  display_name text NOT NULL,
  api_base_url text,
  is_enabled boolean DEFAULT true,
  priority integer DEFAULT 10, -- Lower = higher priority
  rate_limit_per_hour integer DEFAULT 100,
  last_sync_at timestamptz,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed default sources
INSERT INTO price_source_configs (source, display_name, priority) VALUES
  ('ebay', 'eBay Sold Listings', 1),
  ('pricecharting', 'PriceCharting', 2),
  ('vgpc', 'Video Game Price Charting', 3),
  ('user_listing', 'Community Listings', 10),
  ('manual', 'Manual Entry', 99)
ON CONFLICT (source) DO NOTHING;

-- =====================================================
-- USER LISTINGS TABLE
-- Allows users to list items for sale or trade
-- =====================================================
DO $$ BEGIN
  CREATE TYPE listing_status AS ENUM ('draft', 'active', 'sold', 'reserved', 'expired', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE listing_type AS ENUM ('sale', 'trade', 'auction', 'wanted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE item_condition AS ENUM ('new', 'like_new', 'very_good', 'good', 'acceptable', 'poor', 'parts_only');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Game reference
  game_key text NOT NULL,
  game_id integer REFERENCES games(id) ON DELETE SET NULL,
  
  -- Listing details
  listing_type listing_type NOT NULL DEFAULT 'sale',
  status listing_status NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  description text,
  
  -- Item condition
  condition item_condition NOT NULL DEFAULT 'good',
  condition_notes text,
  is_complete_in_box boolean DEFAULT false,
  includes_manual boolean DEFAULT false,
  includes_inserts boolean DEFAULT false,
  
  -- Pricing
  currency text DEFAULT 'USD',
  asking_price_cents integer, -- NULL for trade-only
  minimum_price_cents integer, -- For auctions or negotiations
  shipping_price_cents integer DEFAULT 0,
  is_price_negotiable boolean DEFAULT true,
  
  -- Trade preferences (for listing_type = 'trade')
  trade_preferences jsonb DEFAULT '[]', -- Array of game_keys they'd accept
  trade_notes text,
  
  -- Media
  photos jsonb DEFAULT '[]', -- Array of storage paths/URLs
  
  -- Location (for local pickup)
  country_code text DEFAULT 'US',
  region text, -- State/province
  city text,
  ships_internationally boolean DEFAULT false,
  local_pickup_only boolean DEFAULT false,
  
  -- Visibility and timestamps
  view_count integer DEFAULT 0,
  favorite_count integer DEFAULT 0,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for listing queries
CREATE INDEX IF NOT EXISTS idx_listings_user ON user_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_game_key ON user_listings(game_key);
CREATE INDEX IF NOT EXISTS idx_listings_status ON user_listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_type ON user_listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_listings_price ON user_listings(asking_price_cents) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_listings_location ON user_listings(country_code, region);
CREATE INDEX IF NOT EXISTS idx_listings_expires ON user_listings(expires_at) WHERE status = 'active';

-- =====================================================
-- USER LISTING FAVORITES
-- Track which listings users have favorited
-- =====================================================
CREATE TABLE IF NOT EXISTS user_listing_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES user_listings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

-- =====================================================
-- PRICE ALERTS TABLE
-- Notify users when prices drop below threshold
-- =====================================================
DO $$ BEGIN
  CREATE TYPE alert_status AS ENUM ('active', 'triggered', 'paused', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_type AS ENUM ('price_drop', 'price_below', 'new_listing', 'any_listing');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- What to watch
  game_key text NOT NULL,
  game_name text NOT NULL, -- Denormalized for display
  platform text NOT NULL,
  
  -- Alert configuration
  alert_type alert_type NOT NULL DEFAULT 'price_below',
  target_price_cents integer, -- Trigger when price <= this
  condition_filter item_condition[] DEFAULT ARRAY['new', 'like_new', 'very_good', 'good']::item_condition[],
  include_user_listings boolean DEFAULT true,
  include_market_prices boolean DEFAULT true,
  
  -- Status tracking
  status alert_status NOT NULL DEFAULT 'active',
  last_checked_at timestamptz DEFAULT now(),
  last_triggered_at timestamptz,
  trigger_count integer DEFAULT 0,
  
  -- Notification preferences
  notify_email boolean DEFAULT true,
  notify_push boolean DEFAULT false,
  
  expires_at timestamptz DEFAULT (now() + interval '90 days'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON user_price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_game ON user_price_alerts(game_key);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON user_price_alerts(status) WHERE status = 'active';

-- =====================================================
-- TRADE OFFERS TABLE
-- Allow users to propose trades
-- =====================================================
DO $$ BEGIN
  CREATE TYPE trade_status AS ENUM ('pending', 'accepted', 'declined', 'countered', 'completed', 'cancelled', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS trade_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Participants
  offerer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- What's being traded
  offerer_listing_id uuid REFERENCES user_listings(id) ON DELETE SET NULL,
  recipient_listing_id uuid REFERENCES user_listings(id) ON DELETE SET NULL,
  
  -- Additional items/cash being offered
  offerer_items jsonb DEFAULT '[]', -- Additional games/items
  offerer_cash_cents integer DEFAULT 0, -- Cash to sweeten the deal
  
  -- Status
  status trade_status NOT NULL DEFAULT 'pending',
  message text,
  decline_reason text,
  
  -- Counter-offer tracking
  parent_offer_id uuid REFERENCES trade_offers(id),
  counter_count integer DEFAULT 0,
  
  -- Timestamps
  responded_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trades_offerer ON trade_offers(offerer_id);
CREATE INDEX IF NOT EXISTS idx_trades_recipient ON trade_offers(recipient_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trade_offers(status);

-- =====================================================
-- TRANSACTION HISTORY
-- Record completed sales and trades for user reputation
-- =====================================================
DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('sale', 'purchase', 'trade');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('pending', 'shipped', 'delivered', 'completed', 'disputed', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Participants
  seller_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  buyer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Reference
  listing_id uuid REFERENCES user_listings(id) ON DELETE SET NULL,
  trade_offer_id uuid REFERENCES trade_offers(id) ON DELETE SET NULL,
  
  -- Transaction details
  transaction_type transaction_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'pending',
  
  -- Financial
  sale_price_cents integer,
  shipping_price_cents integer,
  total_cents integer,
  currency text DEFAULT 'USD',
  
  -- Items (for trades with multiple items)
  items jsonb DEFAULT '[]',
  
  -- Shipping
  tracking_number text,
  carrier text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  
  -- Completion
  completed_at timestamptz,
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_seller ON user_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON user_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON user_transactions(status);

-- =====================================================
-- USER RATINGS/FEEDBACK
-- Reputation system for marketplace trust
-- =====================================================
CREATE TABLE IF NOT EXISTS user_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES user_transactions(id) ON DELETE CASCADE,
  
  -- Who is rating whom
  rater_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rated_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Rating (1-5 stars in different categories)
  overall_rating integer NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  communication_rating integer CHECK (communication_rating BETWEEN 1 AND 5),
  shipping_rating integer CHECK (shipping_rating BETWEEN 1 AND 5),
  accuracy_rating integer CHECK (accuracy_rating BETWEEN 1 AND 5),
  
  comment text,
  
  -- Response from rated user
  response text,
  responded_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- One rating per direction per transaction
  UNIQUE(transaction_id, rater_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_rated ON user_ratings(rated_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater ON user_ratings(rater_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE game_price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_source_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_listing_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;

-- Price snapshots: public read, service role write
CREATE POLICY "Public can view price snapshots"
  ON game_price_snapshots FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "Service role can insert price snapshots"
  ON game_price_snapshots FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Price sources: public read
CREATE POLICY "Public can view price sources"
  ON price_source_configs FOR SELECT TO PUBLIC USING (true);

-- User listings: public read active, owners can manage
CREATE POLICY "Public can view active listings"
  ON user_listings FOR SELECT TO PUBLIC
  USING (status = 'active' OR user_id = auth.uid());

CREATE POLICY "Users can create own listings"
  ON user_listings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Users can update own listings"
  ON user_listings FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own listings"
  ON user_listings FOR DELETE
  USING (user_id = auth.uid());

-- Favorites: users manage own
CREATE POLICY "Users can view own favorites"
  ON user_listing_favorites FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own favorites"
  ON user_listing_favorites FOR ALL
  USING (user_id = auth.uid());

-- Price alerts: users manage own
CREATE POLICY "Users can view own alerts"
  ON user_price_alerts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own alerts"
  ON user_price_alerts FOR ALL
  USING (user_id = auth.uid());

-- Trade offers: participants can view
CREATE POLICY "Trade participants can view offers"
  ON trade_offers FOR SELECT
  USING (offerer_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can create trade offers"
  ON trade_offers FOR INSERT
  WITH CHECK (offerer_id = auth.uid());

CREATE POLICY "Participants can update trade offers"
  ON trade_offers FOR UPDATE
  USING (offerer_id = auth.uid() OR recipient_id = auth.uid());

-- Transactions: participants can view
CREATE POLICY "Transaction participants can view"
  ON user_transactions FOR SELECT
  USING (seller_id = auth.uid() OR buyer_id = auth.uid());

-- Ratings: public read, participants write
CREATE POLICY "Public can view ratings"
  ON user_ratings FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "Transaction participants can rate"
  ON user_ratings FOR INSERT
  WITH CHECK (rater_id = auth.uid());

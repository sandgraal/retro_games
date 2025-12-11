-- Migration: Phase 5 Global Catalog Infrastructure
-- Created: December 2025
-- Purpose: Adds community submissions, moderation, and full-text search

-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- CATALOG SUBMISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS catalog_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id),
  user_id uuid,
  submission_type text NOT NULL CHECK (submission_type IN ('new', 'edit', 'delete')),
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  reviewer_id uuid,
  reviewer_notes text,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  merged_at timestamptz
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_submissions_status ON catalog_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON catalog_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_game ON catalog_submissions(game_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON catalog_submissions(created_at DESC);

-- =====================================================
-- AUDIT LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete', 'approve', 'reject', 'merge')),
  old_data jsonb,
  new_data jsonb,
  user_id uuid,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- =====================================================
-- GAME EXTERNAL IDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS game_external_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('igdb', 'rawg', 'giantbomb', 'mobygames', 'pricecharting')),
  external_id text NOT NULL,
  last_synced timestamptz,
  UNIQUE(game_id, source)
);

-- Index for external ID lookups
CREATE INDEX IF NOT EXISTS idx_external_source ON game_external_ids(source, external_id);

-- =====================================================
-- INGESTION RUNS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  records_processed integer DEFAULT 0,
  records_added integer DEFAULT 0,
  records_updated integer DEFAULT 0,
  error_message text
);

-- =====================================================
-- FULL-TEXT SEARCH
-- =====================================================
-- Add search vector to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_games_search ON games USING GIN (search_vector);

-- Create trigram index for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_games_name_trgm ON games USING GIN (game_name gin_trgm_ops);

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_games_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.game_name, '') || ' ' ||
    coalesce(NEW.platform, '') || ' ' ||
    coalesce(NEW.genre, '') || ' ' ||
    coalesce(NEW.region, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update search vector
DROP TRIGGER IF EXISTS games_search_vector_trigger ON games;
CREATE TRIGGER games_search_vector_trigger
  BEFORE INSERT OR UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_games_search_vector();

-- Update existing records
UPDATE games SET search_vector = to_tsvector('english',
  coalesce(game_name, '') || ' ' ||
  coalesce(platform, '') || ' ' ||
  coalesce(genre, '') || ' ' ||
  coalesce(region, '')
);

-- =====================================================
-- SEARCH FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION search_games(
  search_query text,
  limit_count integer DEFAULT 50,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  game_name text,
  platform text,
  genre text,
  rating text,
  release_year text,
  cover text,
  region text,
  rank real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.game_name,
    g.platform,
    g.genre,
    g.rating::text,
    g.release_year::text,
    g.cover,
    g.region,
    GREATEST(
      ts_rank(g.search_vector, plainto_tsquery('english', search_query)),
      similarity(g.game_name, search_query)
    ) as rank
  FROM games g
  WHERE
    g.search_vector @@ plainto_tsquery('english', search_query)
    OR similarity(g.game_name, search_query) > 0.3
  ORDER BY rank DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MODERATION HELPER FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION approve_submission(
  submission_id uuid,
  reviewer_uuid uuid,
  notes text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE catalog_submissions
  SET
    status = 'approved',
    reviewer_id = reviewer_uuid,
    reviewer_notes = notes,
    reviewed_at = now()
  WHERE id = submission_id AND status = 'pending';
  
  INSERT INTO audit_log (table_name, record_id, action, user_id, reason)
  VALUES ('catalog_submissions', submission_id, 'approve', reviewer_uuid, notes);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reject_submission(
  submission_id uuid,
  reviewer_uuid uuid,
  notes text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE catalog_submissions
  SET
    status = 'rejected',
    reviewer_id = reviewer_uuid,
    reviewer_notes = notes,
    reviewed_at = now()
  WHERE id = submission_id AND status = 'pending';
  
  INSERT INTO audit_log (table_name, record_id, action, user_id, reason)
  VALUES ('catalog_submissions', submission_id, 'reject', reviewer_uuid, notes);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE catalog_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_external_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;

-- Submissions: users see own, moderators see all
CREATE POLICY "Users can view own submissions"
  ON catalog_submissions FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('moderator', 'admin')
  ));

CREATE POLICY "Users can create submissions"
  ON catalog_submissions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Moderators can update submissions"
  ON catalog_submissions FOR UPDATE
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('moderator', 'admin')
  ));

-- Audit log: moderators only
CREATE POLICY "Moderators can view audit log"
  ON audit_log FOR SELECT
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('moderator', 'admin')
  ));

-- External IDs: public read
CREATE POLICY "Public can view external IDs"
  ON game_external_ids FOR SELECT
  TO PUBLIC
  USING (true);

-- Ingestion runs: moderators only
CREATE POLICY "Moderators can view ingestion runs"
  ON ingestion_runs FOR SELECT
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('moderator', 'admin')
  ));

-- =====================================================
-- ANON ACCESS FOR SUBMISSIONS (optional)
-- =====================================================
-- Allow anonymous users to create submissions (requires review)
CREATE POLICY "Anon users can create submissions"
  ON catalog_submissions FOR INSERT
  WITH CHECK (true);

-- Allow anonymous to view their own submissions via session
CREATE POLICY "Anon can view pending submissions"
  ON catalog_submissions FOR SELECT
  USING (status = 'pending' OR auth.uid() = user_id);

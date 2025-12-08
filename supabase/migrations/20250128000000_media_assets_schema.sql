-- Media Assets Schema Migration
-- Applied: January 2025
-- Purpose: Complete Phase 2 "Extend schema for media assets" task
-- 
-- This migration was applied via Supabase MCP tools directly to the production database.
-- It creates the following infrastructure:
--
-- Tables:
--   - pending_media: Community-submitted media awaiting moderation
--   - game_media: Approved media linked to games
--   - game_variant_prices: Regional pricing data for game variants
--
-- Storage Buckets (pre-created via Supabase dashboard):
--   - game-covers (public): Approved cover images
--   - media-pending (private): User-submitted media awaiting review
--   - media-archive (private): Archived/backup media
--   - media-auth (private): Authenticated user media
--
-- RLS Policies:
--   - All tables have RLS enabled with appropriate policies
--   - Public tables (platforms, genres) now have RLS enabled
--   - Storage objects have bucket-specific RLS policies

-- ============================================================================
-- PART 1: Enable RLS on reference tables (fix security advisories)
-- ============================================================================

-- Enable RLS on platforms table
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read platforms" ON public.platforms
  FOR SELECT USING (true);

CREATE POLICY "manage platforms" ON public.platforms
  FOR ALL USING (
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  ) WITH CHECK (
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

-- Enable RLS on genres table
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read genres" ON public.genres
  FOR SELECT USING (true);

CREATE POLICY "manage genres" ON public.genres
  FOR ALL USING (
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  ) WITH CHECK (
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

GRANT SELECT ON public.platforms TO anon, authenticated;
GRANT SELECT ON public.genres TO anon, authenticated;
GRANT ALL ON public.platforms TO service_role;
GRANT ALL ON public.genres TO service_role;

-- ============================================================================
-- PART 2: Community contribution workflow - pending_media table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pending_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_key text NOT NULL,
  game_name text,
  platform text,
  media_type text NOT NULL DEFAULT 'cover',
  storage_path text NOT NULL,
  original_filename text,
  content_type text,
  file_size_bytes integer,
  submitted_by uuid REFERENCES auth.users(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS pending_media_status_idx ON public.pending_media (status);
CREATE INDEX IF NOT EXISTS pending_media_game_key_idx ON public.pending_media (game_key);
CREATE INDEX IF NOT EXISTS pending_media_submitted_at_idx ON public.pending_media (submitted_at DESC);

ALTER TABLE public.pending_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read approved pending media" ON public.pending_media
  FOR SELECT USING (status = 'approved');

CREATE POLICY "submit pending media" ON public.pending_media
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = submitted_by
  );

CREATE POLICY "view own pending media" ON public.pending_media
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    auth.uid() = submitted_by
  );

CREATE POLICY "manage pending media" ON public.pending_media
  FOR ALL USING (
    coalesce(current_setting('request.jwt.claim.role', true), '') IN ('service_role', 'content_moderator')
  ) WITH CHECK (
    coalesce(current_setting('request.jwt.claim.role', true), '') IN ('service_role', 'content_moderator')
  );

GRANT SELECT ON public.pending_media TO anon, authenticated;
GRANT INSERT ON public.pending_media TO authenticated;
GRANT ALL ON public.pending_media TO service_role;

-- ============================================================================
-- PART 3: Approved game media table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.game_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_key text NOT NULL,
  media_type text NOT NULL DEFAULT 'cover' CHECK (media_type IN ('cover', 'screenshot', 'box_art', 'manual', 'cart', 'disc')),
  storage_path text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'game-covers',
  public_url text,
  width integer,
  height integer,
  file_size_bytes integer,
  content_type text,
  is_primary boolean DEFAULT false,
  source text DEFAULT 'community',
  attribution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT game_media_unique UNIQUE (game_key, media_type, storage_path)
);

CREATE INDEX IF NOT EXISTS game_media_game_key_idx ON public.game_media (game_key);
CREATE INDEX IF NOT EXISTS game_media_type_idx ON public.game_media (media_type);
CREATE INDEX IF NOT EXISTS game_media_primary_idx ON public.game_media (game_key, media_type) WHERE is_primary = true;

ALTER TABLE public.game_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read game media" ON public.game_media
  FOR SELECT USING (true);

CREATE POLICY "manage game media" ON public.game_media
  FOR INSERT WITH CHECK (
    coalesce(current_setting('request.jwt.claim.role', true), '') IN ('service_role', 'content_moderator')
  );

CREATE POLICY "update game media" ON public.game_media
  FOR UPDATE USING (
    coalesce(current_setting('request.jwt.claim.role', true), '') IN ('service_role', 'content_moderator')
  ) WITH CHECK (
    coalesce(current_setting('request.jwt.claim.role', true), '') IN ('service_role', 'content_moderator')
  );

CREATE POLICY "delete game media" ON public.game_media
  FOR DELETE USING (
    coalesce(current_setting('request.jwt.claim.role', true), '') IN ('service_role', 'content_moderator')
  );

GRANT SELECT ON public.game_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.game_media TO service_role;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS game_media_updated_at ON public.game_media;
CREATE TRIGGER game_media_updated_at
  BEFORE UPDATE ON public.game_media
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- PART 4: Regional variant pricing table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.game_variant_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_key text NOT NULL,
  region_code text NOT NULL DEFAULT 'NTSC',
  currency text NOT NULL DEFAULT 'USD',
  loose_price_cents integer,
  cib_price_cents integer,
  new_price_cents integer,
  source text NOT NULL DEFAULT 'pricecharting',
  snapshot_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_variant_price_unique UNIQUE (game_key, region_code, source)
);

CREATE INDEX IF NOT EXISTS game_variant_prices_game_region_idx ON public.game_variant_prices (game_key, region_code);
CREATE INDEX IF NOT EXISTS game_variant_prices_snapshot_idx ON public.game_variant_prices (snapshot_date DESC);

ALTER TABLE public.game_variant_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read variant prices" ON public.game_variant_prices
  FOR SELECT USING (true);

CREATE POLICY "service upsert variant prices" ON public.game_variant_prices
  FOR INSERT WITH CHECK (
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

CREATE POLICY "service update variant prices" ON public.game_variant_prices
  FOR UPDATE USING (
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  ) WITH CHECK (
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

GRANT SELECT ON public.game_variant_prices TO anon, authenticated;
GRANT INSERT, UPDATE ON public.game_variant_prices TO service_role;

-- ============================================================================
-- PART 5: Storage bucket RLS policies
-- ============================================================================

-- game-covers bucket: public read, service write
CREATE POLICY "public_read_game_covers" ON storage.objects
  FOR SELECT USING (bucket_id = 'game-covers');

CREATE POLICY "service_write_game_covers" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'game-covers' AND
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

CREATE POLICY "service_delete_game_covers" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'game-covers' AND
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

-- media-pending bucket: authenticated upload, service/moderator read
CREATE POLICY "authenticated_upload_media_pending" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'media-pending' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "service_read_media_pending" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'media-pending' AND
    coalesce(current_setting('request.jwt.claim.role', true), '') IN ('service_role', 'content_moderator')
  );

-- media-archive bucket: service role only
CREATE POLICY "service_manage_media_archive" ON storage.objects
  FOR ALL USING (
    bucket_id = 'media-archive' AND
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  ) WITH CHECK (
    bucket_id = 'media-archive' AND
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

-- media-auth bucket: authenticated read, service write
CREATE POLICY "authenticated_read_media_auth" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'media-auth' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "service_write_media_auth" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'media-auth' AND
    coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- Summary of changes:
-- - RLS enabled on platforms and genres tables (security fix)
-- - pending_media table created for community submissions
-- - game_media table created for approved media
-- - game_variant_prices table created for regional pricing
-- - Storage bucket RLS policies configured for all 4 buckets
-- - update_updated_at_column function created with proper search_path

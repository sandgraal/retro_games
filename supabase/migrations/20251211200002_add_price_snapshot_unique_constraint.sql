-- Add unique constraint for upsert operations
-- This enables ON CONFLICT handling in the eBay price update script
ALTER TABLE game_price_snapshots 
ADD CONSTRAINT game_price_snapshots_unique_daily 
UNIQUE (game_key, snapshot_date, source);

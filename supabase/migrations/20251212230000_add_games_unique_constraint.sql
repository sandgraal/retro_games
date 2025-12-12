-- Migration: Add unique constraint on games table for catalog sync
-- Created: December 2025
-- Purpose: Enable upsert operations during IGDB catalog sync

-- Add unique constraint on game_name + platform for upsert support
-- This allows the catalog ingest to update existing games without duplicates
ALTER TABLE games ADD CONSTRAINT games_name_platform_unique UNIQUE (game_name, platform);

-- Add index to improve upsert performance
CREATE INDEX IF NOT EXISTS idx_games_name_platform ON games(game_name, platform);

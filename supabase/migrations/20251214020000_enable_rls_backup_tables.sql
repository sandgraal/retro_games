-- Migration: Enable RLS on backup tables
-- Created: 2024-12-14
-- Description: Enable Row Level Security on backup/archive tables to prevent API access

-- Enable RLS on backup tables and restrict access to service role only
-- These are backup/archive tables that shouldn't be accessed via the public API

ALTER TABLE public.games_duplicate_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games_pre_consolidation ENABLE ROW LEVEL SECURITY;

-- No policies are created intentionally - this blocks all anon/authenticated access
-- Only the service role can access these tables (bypasses RLS by default)

-- Migration 010: Garmin Export Storage Table (user_memory_snapshots)
-- Records the existing user_memory_snapshots table used by Garmin webhook storage.
-- All access is via service role only (API routes). Client access is denied via RLS.
-- Author: Claude Code
-- Date: 2026-02-19

-- ============================================================================
-- TABLE: user_memory_snapshots
-- Created outside the migration system; this migration documents and hardens it.
-- ============================================================================

-- Create table if it does not already exist (idempotent).
CREATE TABLE IF NOT EXISTS public.user_memory_snapshots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id  text NOT NULL UNIQUE,
  user_id    bigint NULL,
  snapshot   jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary    jsonb NULL,
  last_seen_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_memory_snapshots IS
  'Stores Garmin export summaries delivered via webhook ping/pull or push. '
  'All access is via server-side service role only. No client-side access is permitted.';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_memory_snapshots_user_id
  ON public.user_memory_snapshots (user_id);

CREATE INDEX IF NOT EXISTS idx_user_memory_snapshots_updated_at
  ON public.user_memory_snapshots (updated_at DESC);

-- Prefix scan for device_id LIKE 'garmin_export:<userId>:%'
CREATE INDEX IF NOT EXISTS idx_user_memory_snapshots_device_prefix
  ON public.user_memory_snapshots (device_id text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_user_memory_last_seen_at
  ON public.user_memory_snapshots (last_seen_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- All writes and reads go through Next.js API routes using the service role key,
-- which bypasses RLS. Direct client access (anon / authenticated) is denied.
-- ============================================================================

ALTER TABLE public.user_memory_snapshots ENABLE ROW LEVEL SECURITY;

-- Remove any legacy permissive policy that may exist from earlier setup.
DROP POLICY IF EXISTS "Allow all operations on user_memory_snapshots" ON public.user_memory_snapshots;

-- No SELECT / INSERT / UPDATE / DELETE policies are created for anon or
-- authenticated roles. Service role always bypasses RLS automatically.

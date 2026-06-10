-- Migration 015: Add local_id to plans and workouts for web → Supabase sync
-- Enables the SyncService to upsert training plans and workouts using the
-- Dexie primary key as a stable deduplication key.
-- Author: Claude Code
-- Date: 2026-05-03

-- ============================================================================
-- PLANS: Add local_id for upsert deduplication
-- ============================================================================

ALTER TABLE plans ADD COLUMN IF NOT EXISTS local_id BIGINT;

-- Unique index so upsert can use onConflict: 'profile_id,local_id'
CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_profile_local_id
  ON plans (profile_id, local_id)
  WHERE local_id IS NOT NULL;

-- ============================================================================
-- WORKOUTS: Add local_id for upsert deduplication
-- ============================================================================

ALTER TABLE workouts ADD COLUMN IF NOT EXISTS local_id BIGINT;

-- Unique index so upsert can use onConflict: 'plan_id,local_id'
CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_plan_local_id
  ON workouts (plan_id, local_id)
  WHERE local_id IS NOT NULL;

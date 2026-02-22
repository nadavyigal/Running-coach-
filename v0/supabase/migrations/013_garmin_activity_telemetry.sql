-- Migration 013: Persist rich Garmin activity telemetry
-- Adds cadence, laps/splits/interval summaries, and full telemetry payload storage.

ALTER TABLE IF EXISTS public.garmin_activities
  ADD COLUMN IF NOT EXISTS avg_cadence_spm double precision NULL,
  ADD COLUMN IF NOT EXISTS max_cadence_spm double precision NULL,
  ADD COLUMN IF NOT EXISTS elevation_loss_m double precision NULL,
  ADD COLUMN IF NOT EXISTS max_speed_mps double precision NULL,
  ADD COLUMN IF NOT EXISTS lap_summaries jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS split_summaries jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS interval_summaries jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS telemetry_json jsonb NOT NULL DEFAULT '{}'::jsonb;


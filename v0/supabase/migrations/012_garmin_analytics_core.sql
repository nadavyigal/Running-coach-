-- Migration 012: Garmin analytics core tables
-- Adds normalized Garmin activity/daily metrics storage plus scaffolding
-- for derived metrics and AI insights.

-- ============================================================================
-- TABLE: garmin_activities
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.garmin_activities (
  id                  bigserial PRIMARY KEY,
  user_id             bigint NOT NULL,
  auth_user_id        uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_id         text NOT NULL,
  start_time          timestamptz NULL,
  sport               text NULL,
  duration_s          integer NULL,
  distance_m          double precision NULL,
  avg_hr              integer NULL,
  max_hr              integer NULL,
  avg_pace            double precision NULL,
  elevation_gain_m    double precision NULL,
  calories            double precision NULL,
  source              text NOT NULL DEFAULT 'garmin_sync',
  raw_json            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT garmin_activities_user_activity_unique UNIQUE (user_id, activity_id)
);

-- ============================================================================
-- TABLE: garmin_daily_metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.garmin_daily_metrics (
  id                  bigserial PRIMARY KEY,
  user_id             bigint NOT NULL,
  auth_user_id        uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  date                date NOT NULL,
  steps               integer NULL,
  sleep_score         double precision NULL,
  sleep_duration_s    integer NULL,
  hrv                 double precision NULL,
  resting_hr          integer NULL,
  stress              double precision NULL,
  body_battery        integer NULL,
  training_readiness  integer NULL,
  vo2max              double precision NULL,
  weight              double precision NULL,
  raw_json            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT garmin_daily_metrics_user_date_unique UNIQUE (user_id, date)
);

-- ============================================================================
-- TABLE: training_derived_metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.training_derived_metrics (
  id                      bigserial PRIMARY KEY,
  user_id                 bigint NOT NULL,
  auth_user_id            uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  date                    date NOT NULL,
  acute_load_7d           double precision NULL,
  chronic_load_28d        double precision NULL,
  acwr                    double precision NULL,
  monotony_7d             double precision NULL,
  strain_7d               double precision NULL,
  weekly_volume_m         double precision NULL,
  weekly_intensity_score  double precision NULL,
  flags_json              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_derived_metrics_user_date_unique UNIQUE (user_id, date)
);

-- ============================================================================
-- TABLE: ai_insights
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id                bigserial PRIMARY KEY,
  user_id           bigint NOT NULL,
  auth_user_id      uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  period_start      date NOT NULL,
  period_end        date NOT NULL,
  type              text NOT NULL CHECK (type IN ('daily', 'weekly', 'post_run')),
  insight_markdown  text NOT NULL,
  confidence        double precision NULL,
  evidence_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_garmin_activities_user_start_time
  ON public.garmin_activities (user_id, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_garmin_activities_auth_user_id
  ON public.garmin_activities (auth_user_id);

CREATE INDEX IF NOT EXISTS idx_garmin_daily_metrics_user_date
  ON public.garmin_daily_metrics (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_garmin_daily_metrics_auth_user_id
  ON public.garmin_daily_metrics (auth_user_id);

CREATE INDEX IF NOT EXISTS idx_training_derived_metrics_user_date
  ON public.training_derived_metrics (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_training_derived_metrics_auth_user_id
  ON public.training_derived_metrics (auth_user_id);

CREATE INDEX IF NOT EXISTS idx_ai_insights_user_period
  ON public.ai_insights (user_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_ai_insights_type
  ON public.ai_insights (type);

CREATE INDEX IF NOT EXISTS idx_ai_insights_auth_user_id
  ON public.ai_insights (auth_user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.garmin_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garmin_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_derived_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "garmin_activities_select_own" ON public.garmin_activities;
CREATE POLICY "garmin_activities_select_own"
  ON public.garmin_activities
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "garmin_activities_insert_own" ON public.garmin_activities;
CREATE POLICY "garmin_activities_insert_own"
  ON public.garmin_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "garmin_activities_update_own" ON public.garmin_activities;
CREATE POLICY "garmin_activities_update_own"
  ON public.garmin_activities
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "garmin_daily_metrics_select_own" ON public.garmin_daily_metrics;
CREATE POLICY "garmin_daily_metrics_select_own"
  ON public.garmin_daily_metrics
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "garmin_daily_metrics_insert_own" ON public.garmin_daily_metrics;
CREATE POLICY "garmin_daily_metrics_insert_own"
  ON public.garmin_daily_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "garmin_daily_metrics_update_own" ON public.garmin_daily_metrics;
CREATE POLICY "garmin_daily_metrics_update_own"
  ON public.garmin_daily_metrics
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "training_derived_metrics_select_own" ON public.training_derived_metrics;
CREATE POLICY "training_derived_metrics_select_own"
  ON public.training_derived_metrics
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "training_derived_metrics_insert_own" ON public.training_derived_metrics;
CREATE POLICY "training_derived_metrics_insert_own"
  ON public.training_derived_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "training_derived_metrics_update_own" ON public.training_derived_metrics;
CREATE POLICY "training_derived_metrics_update_own"
  ON public.training_derived_metrics
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "ai_insights_select_own" ON public.ai_insights;
CREATE POLICY "ai_insights_select_own"
  ON public.ai_insights
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "ai_insights_insert_own" ON public.ai_insights;
CREATE POLICY "ai_insights_insert_own"
  ON public.ai_insights
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "ai_insights_update_own" ON public.ai_insights;
CREATE POLICY "ai_insights_update_own"
  ON public.ai_insights
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

REVOKE ALL ON TABLE public.garmin_activities FROM anon;
REVOKE ALL ON TABLE public.garmin_daily_metrics FROM anon;
REVOKE ALL ON TABLE public.training_derived_metrics FROM anon;
REVOKE ALL ON TABLE public.ai_insights FROM anon;

GRANT SELECT, INSERT, UPDATE ON TABLE public.garmin_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.garmin_daily_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.training_derived_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_insights TO authenticated;

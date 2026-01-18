-- Migration 006: Authenticated User Schema
-- Creates tables for user data sync: runs, goals, shoes, recovery metrics, and performance tracking
-- Author: Claude Code
-- Date: 2026-01-18

-- ============================================================================
-- RUNS TABLE (Most Critical - Complete Athletic History)
-- ============================================================================

CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,

    -- Run details
    type TEXT NOT NULL CHECK (type IN ('easy', 'tempo', 'intervals', 'long', 'time-trial', 'hill', 'recovery', 'race', 'other')),
    distance DECIMAL NOT NULL CHECK (distance >= 0),
    duration INTEGER NOT NULL CHECK (duration > 0), -- seconds
    pace INTEGER CHECK (pace > 0), -- seconds per km

    -- Physiological data
    heart_rate INTEGER CHECK (heart_rate >= 0 AND heart_rate <= 300),
    calories INTEGER CHECK (calories >= 0),

    -- User notes and AI analysis
    notes TEXT,
    run_report JSONB,
    run_report_source TEXT CHECK (run_report_source IN ('ai', 'fallback')),

    -- GPS and route data
    route JSONB, -- GPS path as array of {lat, lng, timestamp, altitude}
    gps_accuracy_data JSONB,
    start_accuracy DECIMAL CHECK (start_accuracy >= 0),
    end_accuracy DECIMAL CHECK (end_accuracy >= 0),
    average_accuracy DECIMAL CHECK (average_accuracy >= 0),

    -- Equipment tracking
    shoe_id UUID REFERENCES shoes(id) ON DELETE SET NULL,

    -- Timestamps
    completed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Sync tracking
    local_id BIGINT, -- Original Dexie ID for conflict resolution
    last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for runs table
CREATE INDEX IF NOT EXISTS idx_runs_profile_id ON runs(profile_id);
CREATE INDEX IF NOT EXISTS idx_runs_completed_at ON runs(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_profile_completed ON runs(profile_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_local_id ON runs(profile_id, local_id);
CREATE INDEX IF NOT EXISTS idx_runs_workout_id ON runs(workout_id) WHERE workout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_runs_shoe_id ON runs(shoe_id) WHERE shoe_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_runs_last_synced ON runs(profile_id, last_synced_at);

-- Add unique constraint on profile_id + local_id for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_profile_local_id_unique ON runs(profile_id, local_id) WHERE local_id IS NOT NULL;

-- ============================================================================
-- GOALS TABLE (User Objectives and Progress)
-- ============================================================================

CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Goal details
    title TEXT NOT NULL,
    description TEXT,
    goal_type TEXT NOT NULL CHECK (goal_type IN ('time_improvement', 'distance_achievement', 'frequency', 'race_completion', 'consistency', 'health', 'other')),
    category TEXT NOT NULL CHECK (category IN ('performance', 'consistency', 'health', 'race', 'custom')),

    -- Priority and status
    priority INTEGER CHECK (priority IN (1, 2, 3)),
    status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),

    -- Progress tracking
    baseline_value DECIMAL NOT NULL,
    target_value DECIMAL NOT NULL,
    current_value DECIMAL NOT NULL,
    progress_percentage DECIMAL NOT NULL CHECK (progress_percentage >= 0 AND progress_percentage <= 100),

    -- Goal metadata
    is_primary BOOLEAN DEFAULT FALSE,
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Sync tracking
    local_id BIGINT
);

-- Indexes for goals table
CREATE INDEX IF NOT EXISTS idx_goals_profile_id ON goals(profile_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_goals_primary ON goals(profile_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_goals_plan_id ON goals(plan_id) WHERE plan_id IS NOT NULL;

-- Unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_profile_local_id_unique ON goals(profile_id, local_id) WHERE local_id IS NOT NULL;

-- ============================================================================
-- GOAL PROGRESS HISTORY (Timeline of Goal Progress)
-- ============================================================================

CREATE TABLE IF NOT EXISTS goal_progress_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,

    -- Progress measurement
    measurement_date TIMESTAMPTZ NOT NULL,
    measured_value DECIMAL NOT NULL,
    progress_percentage DECIMAL NOT NULL CHECK (progress_percentage >= 0 AND progress_percentage <= 100),

    -- Context
    auto_recorded BOOLEAN NOT NULL DEFAULT FALSE,
    contributing_activity_id UUID REFERENCES runs(id) ON DELETE SET NULL,
    context JSONB, -- Additional context about the measurement
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Sync tracking
    local_id BIGINT
);

-- Indexes for goal progress history
CREATE INDEX IF NOT EXISTS idx_goal_progress_goal_id ON goal_progress_history(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_date ON goal_progress_history(goal_id, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_goal_progress_activity ON goal_progress_history(contributing_activity_id) WHERE contributing_activity_id IS NOT NULL;

-- Unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_progress_goal_local_id_unique ON goal_progress_history(goal_id, local_id) WHERE local_id IS NOT NULL;

-- ============================================================================
-- SHOES TABLE (Running Equipment Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS shoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Shoe details
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,

    -- Mileage tracking
    initial_km DECIMAL NOT NULL DEFAULT 0 CHECK (initial_km >= 0),
    current_km DECIMAL NOT NULL DEFAULT 0 CHECK (current_km >= 0),
    max_km DECIMAL NOT NULL DEFAULT 800 CHECK (max_km > 0),

    -- Status
    start_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Sync tracking
    local_id BIGINT
);

-- Indexes for shoes table
CREATE INDEX IF NOT EXISTS idx_shoes_profile_id ON shoes(profile_id);
CREATE INDEX IF NOT EXISTS idx_shoes_active ON shoes(profile_id, is_active);
CREATE INDEX IF NOT EXISTS idx_shoes_current_km ON shoes(profile_id, current_km DESC);

-- Unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_shoes_profile_local_id_unique ON shoes(profile_id, local_id) WHERE local_id IS NOT NULL;

-- ============================================================================
-- SLEEP DATA (Recovery Metrics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sleep_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Source tracking
    device_id TEXT,
    source TEXT CHECK (source IN ('manual', 'apple_watch', 'garmin', 'fitbit', 'whoop', 'oura', 'other')),

    -- Sleep metrics
    sleep_date DATE NOT NULL,
    total_sleep_time INTEGER NOT NULL CHECK (total_sleep_time >= 0), -- minutes
    deep_sleep_time INTEGER CHECK (deep_sleep_time >= 0), -- minutes
    light_sleep_time INTEGER CHECK (light_sleep_time >= 0), -- minutes
    rem_sleep_time INTEGER CHECK (rem_sleep_time >= 0), -- minutes
    awake_time INTEGER CHECK (awake_time >= 0), -- minutes

    -- Sleep quality
    sleep_efficiency DECIMAL NOT NULL CHECK (sleep_efficiency >= 0 AND sleep_efficiency <= 100),
    sleep_score INTEGER CHECK (sleep_score >= 0 AND sleep_score <= 100),

    -- Additional context
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Sync tracking
    local_id BIGINT
);

-- Indexes for sleep data
CREATE INDEX IF NOT EXISTS idx_sleep_profile_id ON sleep_data(profile_id);
CREATE INDEX IF NOT EXISTS idx_sleep_profile_date ON sleep_data(profile_id, sleep_date DESC);
CREATE INDEX IF NOT EXISTS idx_sleep_date ON sleep_data(sleep_date DESC);

-- Unique constraint: one sleep record per profile per date
CREATE UNIQUE INDEX IF NOT EXISTS idx_sleep_profile_date_unique ON sleep_data(profile_id, sleep_date);

-- Unique constraint for upsert via local_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_sleep_profile_local_id_unique ON sleep_data(profile_id, local_id) WHERE local_id IS NOT NULL;

-- ============================================================================
-- HRV MEASUREMENTS (Heart Rate Variability)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hrv_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Source tracking
    device_id TEXT,
    source TEXT CHECK (source IN ('manual', 'apple_watch', 'garmin', 'fitbit', 'whoop', 'oura', 'polar', 'other')),

    -- HRV data
    measurement_date TIMESTAMPTZ NOT NULL,
    hrv_value DECIMAL NOT NULL CHECK (hrv_value >= 0),
    hrv_type TEXT NOT NULL CHECK (hrv_type IN ('rmssd', 'sdnn', 'pnn50', 'other')),

    -- Additional metrics
    resting_heart_rate INTEGER CHECK (resting_heart_rate >= 0 AND resting_heart_rate <= 300),
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    recovery_status TEXT CHECK (recovery_status IN ('poor', 'fair', 'good', 'excellent')),

    -- Context
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Sync tracking
    local_id BIGINT
);

-- Indexes for HRV measurements
CREATE INDEX IF NOT EXISTS idx_hrv_profile_id ON hrv_measurements(profile_id);
CREATE INDEX IF NOT EXISTS idx_hrv_profile_date ON hrv_measurements(profile_id, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_hrv_date ON hrv_measurements(measurement_date DESC);

-- Unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_hrv_profile_local_id_unique ON hrv_measurements(profile_id, local_id) WHERE local_id IS NOT NULL;

-- ============================================================================
-- RECOVERY SCORES (Composite Recovery Assessment)
-- ============================================================================

CREATE TABLE IF NOT EXISTS recovery_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Score data
    score_date DATE NOT NULL,
    overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),

    -- Component scores
    sleep_score INTEGER NOT NULL CHECK (sleep_score >= 0 AND sleep_score <= 100),
    hrv_score INTEGER NOT NULL CHECK (hrv_score >= 0 AND hrv_score <= 100),
    resting_hr_score INTEGER NOT NULL CHECK (resting_hr_score >= 0 AND resting_hr_score <= 100),
    subjective_wellness_score INTEGER NOT NULL CHECK (subjective_wellness_score >= 0 AND subjective_wellness_score <= 100),
    readiness_score INTEGER NOT NULL CHECK (readiness_score >= 0 AND readiness_score <= 100),

    -- Recommendations
    recommendations JSONB NOT NULL, -- Array of recommendation objects

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Sync tracking
    local_id BIGINT
);

-- Indexes for recovery scores
CREATE INDEX IF NOT EXISTS idx_recovery_profile_id ON recovery_scores(profile_id);
CREATE INDEX IF NOT EXISTS idx_recovery_profile_date ON recovery_scores(profile_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_overall_score ON recovery_scores(profile_id, overall_score DESC);

-- Unique constraint: one recovery score per profile per date
CREATE UNIQUE INDEX IF NOT EXISTS idx_recovery_profile_date_unique ON recovery_scores(profile_id, score_date);

-- Unique constraint for upsert via local_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_recovery_profile_local_id_unique ON recovery_scores(profile_id, local_id) WHERE local_id IS NOT NULL;

-- ============================================================================
-- PERSONAL RECORDS (Performance Milestones)
-- ============================================================================

CREATE TABLE IF NOT EXISTS personal_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Record details
    record_type TEXT NOT NULL CHECK (record_type IN ('fastest_1k', 'fastest_5k', 'fastest_10k', 'fastest_half_marathon', 'fastest_marathon', 'longest_run', 'best_pace', 'most_elevation', 'other')),
    value DECIMAL NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('seconds', 'meters', 'pace_seconds_per_km', 'other')),

    -- Context
    achieved_at TIMESTAMPTZ NOT NULL,
    run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Sync tracking
    local_id BIGINT
);

-- Indexes for personal records
CREATE INDEX IF NOT EXISTS idx_pr_profile_id ON personal_records(profile_id);
CREATE INDEX IF NOT EXISTS idx_pr_type ON personal_records(profile_id, record_type);
CREATE INDEX IF NOT EXISTS idx_pr_achieved ON personal_records(profile_id, achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_run_id ON personal_records(run_id) WHERE run_id IS NOT NULL;

-- Unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_pr_profile_local_id_unique ON personal_records(profile_id, local_id) WHERE local_id IS NOT NULL;

-- ============================================================================
-- HEART RATE ZONES (Training Zone Configuration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS heart_rate_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Zone configuration
    zone_number INTEGER NOT NULL CHECK (zone_number >= 1 AND zone_number <= 5),
    name TEXT NOT NULL, -- e.g., "Recovery", "Aerobic", "Threshold", "VO2 Max", "Anaerobic"
    description TEXT,

    -- Heart rate ranges
    min_bpm INTEGER NOT NULL CHECK (min_bpm >= 0 AND min_bpm <= 300),
    max_bpm INTEGER NOT NULL CHECK (max_bpm >= 0 AND max_bpm <= 300),

    -- Visual styling
    color TEXT NOT NULL, -- Hex color code

    -- Training benefit
    training_benefit TEXT NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Sync tracking
    local_id BIGINT,

    -- Ensure max_bpm > min_bpm
    CONSTRAINT check_hr_zone_range CHECK (max_bpm > min_bpm)
);

-- Indexes for heart rate zones
CREATE INDEX IF NOT EXISTS idx_hr_zones_profile_id ON heart_rate_zones(profile_id);
CREATE INDEX IF NOT EXISTS idx_hr_zones_zone_number ON heart_rate_zones(profile_id, zone_number);

-- Unique constraint: one zone per zone_number per profile
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_zones_profile_zone_unique ON heart_rate_zones(profile_id, zone_number);

-- Unique constraint for upsert via local_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_zones_profile_local_id_unique ON heart_rate_zones(profile_id, local_id) WHERE local_id IS NOT NULL;

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- Automatically update the updated_at timestamp on row modification
-- ============================================================================

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at column
CREATE TRIGGER update_runs_updated_at BEFORE UPDATE ON runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shoes_updated_at BEFORE UPDATE ON shoes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sleep_data_updated_at BEFORE UPDATE ON sleep_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recovery_scores_updated_at BEFORE UPDATE ON recovery_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personal_records_updated_at BEFORE UPDATE ON personal_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_heart_rate_zones_updated_at BEFORE UPDATE ON heart_rate_zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE runs IS 'Complete athletic history of all user runs with GPS data, performance metrics, and AI analysis';
COMMENT ON TABLE goals IS 'User objectives and targets with progress tracking';
COMMENT ON TABLE goal_progress_history IS 'Timeline of goal progress measurements';
COMMENT ON TABLE shoes IS 'Running shoe inventory with mileage tracking for maintenance';
COMMENT ON TABLE sleep_data IS 'Sleep metrics for recovery monitoring';
COMMENT ON TABLE hrv_measurements IS 'Heart rate variability measurements for recovery assessment';
COMMENT ON TABLE recovery_scores IS 'Composite recovery scores combining multiple metrics';
COMMENT ON TABLE personal_records IS 'User performance milestones and achievements';
COMMENT ON TABLE heart_rate_zones IS 'Personalized heart rate training zones';

COMMENT ON COLUMN runs.local_id IS 'Original Dexie IndexedDB ID for conflict resolution during sync';
COMMENT ON COLUMN runs.route IS 'GPS path as JSONB array of coordinate objects';
COMMENT ON COLUMN goals.progress_percentage IS 'Calculated progress toward target (0-100)';
COMMENT ON COLUMN shoes.current_km IS 'Accumulated mileage on this shoe';
COMMENT ON COLUMN recovery_scores.recommendations IS 'AI-generated recovery recommendations as JSONB array';

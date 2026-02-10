-- Migration: Create analytics_events table for PostHog integration
-- Purpose: Store analytics events in PostgreSQL for custom dashboards
-- Created: 2026-02-10

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  user_id TEXT,
  properties JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_properties ON analytics_events USING gin(properties);

-- Create composite index for funnel queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_funnel ON analytics_events(event_name, user_id, timestamp);

-- Enable Row Level Security (RLS)
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous inserts (for event tracking)
CREATE POLICY "Allow anonymous inserts"
  ON analytics_events
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create policy to allow anonymous selects (for dashboards)
CREATE POLICY "Allow anonymous selects"
  ON analytics_events
  FOR SELECT
  TO anon
  USING (true);

-- Create policy to allow authenticated users to insert
CREATE POLICY "Allow authenticated inserts"
  ON analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policy to allow authenticated users to select
CREATE POLICY "Allow authenticated selects"
  ON analytics_events
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy to allow service role full access
CREATE POLICY "Allow service role all operations"
  ON analytics_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE analytics_events IS 'Stores analytics events for PostHog integration and custom dashboards';
COMMENT ON COLUMN analytics_events.event_name IS 'Name of the event (e.g., signup_completed, plan_generated)';
COMMENT ON COLUMN analytics_events.user_id IS 'User ID associated with the event';
COMMENT ON COLUMN analytics_events.properties IS 'JSON object containing event properties and metadata';
COMMENT ON COLUMN analytics_events.timestamp IS 'When the event occurred';
COMMENT ON COLUMN analytics_events.created_at IS 'When the record was created in the database';

-- Grant permissions
GRANT SELECT, INSERT ON analytics_events TO anon;
GRANT ALL ON analytics_events TO authenticated;
GRANT ALL ON analytics_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE analytics_events_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE analytics_events_id_seq TO authenticated;
GRANT ALL ON SEQUENCE analytics_events_id_seq TO service_role;

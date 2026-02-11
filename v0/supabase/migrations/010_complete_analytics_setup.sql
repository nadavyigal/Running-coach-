-- Complete Analytics Events Setup
-- Creates table + proper RLS policies for event tracking
-- Combines migrations 008 + 009 with fixes

-- Drop table if exists (for clean slate)
DROP TABLE IF EXISTS analytics_events CASCADE;

-- Create analytics_events table
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  user_id TEXT,
  session_id TEXT,
  properties JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common query patterns
CREATE INDEX idx_events_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX idx_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_events_session_id ON analytics_events(session_id);
CREATE INDEX idx_events_event_name ON analytics_events(event_name);
CREATE INDEX idx_events_user_timestamp ON analytics_events(user_id, timestamp DESC);
CREATE INDEX idx_events_properties ON analytics_events USING gin(properties);

-- Enable Row Level Security
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy 1: Allow anonymous users to INSERT events (for client-side tracking)
CREATE POLICY "Allow anonymous event inserts"
  ON analytics_events
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- RLS Policy 2: Allow authenticated users to INSERT events
CREATE POLICY "Authenticated users can insert events"
  ON analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policy 3: Allow authenticated users to SELECT all events (for dashboards)
CREATE POLICY "Authenticated users can view all events"
  ON analytics_events
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policy 4: Service role has full access (for API routes)
CREATE POLICY "Service role has full access"
  ON analytics_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT INSERT ON analytics_events TO anon;
GRANT INSERT, SELECT ON analytics_events TO authenticated;
GRANT ALL ON analytics_events TO service_role;

-- Retention cleanup function (deletes events older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_analytics_events()
RETURNS void AS $$
BEGIN
  DELETE FROM analytics_events
  WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on cleanup function
GRANT EXECUTE ON FUNCTION cleanup_old_analytics_events TO authenticated, anon;

-- Add helpful comments
COMMENT ON TABLE analytics_events IS 'Stores analytics events for PostHog integration and custom dashboards';
COMMENT ON COLUMN analytics_events.event_name IS 'Name of the event (e.g., signup_completed, plan_generated)';
COMMENT ON COLUMN analytics_events.user_id IS 'User ID associated with the event';
COMMENT ON COLUMN analytics_events.properties IS 'JSON object containing event properties and metadata';
COMMENT ON COLUMN analytics_events.timestamp IS 'When the event occurred';
COMMENT ON COLUMN analytics_events.created_at IS 'When the record was created in the database';

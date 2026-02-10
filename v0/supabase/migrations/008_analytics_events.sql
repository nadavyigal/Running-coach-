-- Phase 4: Analytics Events Table for PostgreSQL Backend
-- Migrate from in-memory event storage to persistent PostgreSQL

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  user_id TEXT,
  session_id TEXT,
  properties JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_user_timestamp ON analytics_events(user_id, timestamp DESC);

-- Enable Row Level Security
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated admins can read analytics events
CREATE POLICY IF NOT EXISTS "Admin users can view all analytics events"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
  );

-- Retention cleanup function (deletes events older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_analytics_events()
RETURNS void AS $$
BEGIN
  DELETE FROM analytics_events
  WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_old_analytics_events TO authenticated, anon;

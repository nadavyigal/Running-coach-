-- Fix RLS policies for analytics_events to allow event tracking
-- Issue: Previous policy only allowed authenticated reads, blocking anonymous event inserts
-- Solution: Add policies for anonymous inserts and service role operations

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admin users can view all analytics events" ON analytics_events;

-- Allow anonymous users to INSERT events (for client-side tracking)
CREATE POLICY "Allow anonymous event inserts"
  ON analytics_events
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to SELECT their own events and INSERT new ones
CREATE POLICY "Authenticated users can insert events"
  ON analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view all events"
  ON analytics_events
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role full access (for API routes)
CREATE POLICY "Service role has full access"
  ON analytics_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT INSERT ON analytics_events TO anon;
GRANT INSERT, SELECT ON analytics_events TO authenticated;
GRANT ALL ON analytics_events TO service_role;

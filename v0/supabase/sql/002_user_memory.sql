-- User memory snapshots (server-side backup of local state)

CREATE TABLE IF NOT EXISTS user_memory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL UNIQUE,
  user_id BIGINT,
  snapshot JSONB NOT NULL,
  summary JSONB,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_memory_last_seen_at ON user_memory_snapshots (last_seen_at);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER update_user_memory_snapshots_updated_at
  BEFORE UPDATE ON user_memory_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Trigger update_user_memory_snapshots_updated_at already exists, skipping';
END $$;

-- Migration 011: Garmin OAuth lifecycle hardening
-- Adds server-side Garmin connection/token storage for secure OAuth lifecycle management.
-- Tokens are encrypted before persistence and are never exposed to client APIs.
-- Author: Codex
-- Date: 2026-02-22

-- ============================================================================
-- TABLE: garmin_connections
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.garmin_connections (
  id               bigserial PRIMARY KEY,
  user_id          bigint NOT NULL UNIQUE,
  auth_user_id     uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  garmin_user_id   text NULL,
  scopes           text[] NOT NULL DEFAULT '{}'::text[],
  status           text NOT NULL DEFAULT 'connected'
                   CHECK (status IN ('connected', 'revoked', 'error', 'disconnected')),
  connected_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at       timestamptz NULL,
  last_sync_at     timestamptz NULL,
  last_sync_cursor text NULL,
  error_state      jsonb NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.garmin_connections IS
  'Garmin connection lifecycle state for each RunSmart user.';

-- ============================================================================
-- TABLE: garmin_tokens
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.garmin_tokens (
  id                       bigserial PRIMARY KEY,
  user_id                  bigint NOT NULL UNIQUE,
  auth_user_id             uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  access_token_encrypted   text NOT NULL,
  refresh_token_encrypted  text NULL,
  expires_at               timestamptz NOT NULL,
  rotated_at               timestamptz NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.garmin_tokens IS
  'Encrypted Garmin OAuth tokens. Service role only for read/write.';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_garmin_connections_status
  ON public.garmin_connections (status);

CREATE INDEX IF NOT EXISTS idx_garmin_connections_last_sync_at
  ON public.garmin_connections (last_sync_at DESC);

CREATE INDEX IF NOT EXISTS idx_garmin_connections_auth_user_id
  ON public.garmin_connections (auth_user_id);

CREATE INDEX IF NOT EXISTS idx_garmin_tokens_expires_at
  ON public.garmin_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_garmin_tokens_auth_user_id
  ON public.garmin_tokens (auth_user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.garmin_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garmin_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "garmin_connections_select_own" ON public.garmin_connections;
CREATE POLICY "garmin_connections_select_own"
  ON public.garmin_connections
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "garmin_connections_update_own" ON public.garmin_connections;
CREATE POLICY "garmin_connections_update_own"
  ON public.garmin_connections
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- No client policies on garmin_tokens: service role only.

REVOKE ALL ON TABLE public.garmin_tokens FROM anon, authenticated;
REVOKE ALL ON TABLE public.garmin_connections FROM anon;
GRANT SELECT, UPDATE ON TABLE public.garmin_connections TO authenticated;

-- Garmin webhook storage: lock down RLS on user_memory_snapshots.
-- All writes go via service role (webhook handler), all reads via service role (API routes).
-- Direct client access with anon/authenticated keys must be denied.

-- Remove the overly-permissive public policy
DROP POLICY IF EXISTS "Allow all operations on user_memory_snapshots" ON public.user_memory_snapshots;

-- Ensure RLS is still enabled (was already enabled, but be explicit)
ALTER TABLE public.user_memory_snapshots ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon or authenticated roles.
-- Service role always bypasses RLS, so the webhook handler and API routes
-- continue to work without any policy grant.

-- Add a comment documenting this intent
COMMENT ON TABLE public.user_memory_snapshots IS
  'Stores Garmin export summaries delivered via webhook ping/pull or push. '
  'All access is via server-side service role only. No client-side access is permitted.';;

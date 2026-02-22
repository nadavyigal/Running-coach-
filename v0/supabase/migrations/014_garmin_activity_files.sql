-- Migration 014: Garmin Activity Files (FIT binary pipeline)
-- Tracks FIT file push notifications from Garmin Activity API and their download/parse status.

-- ─── garmin_activity_files ───────────────────────────────────────────────────
-- Stores one row per activityFiles push notification from Garmin.
-- The derive worker downloads the FIT binary from callback_url and parses it
-- into garmin_activities (lap_summaries, split_summaries, telemetry_json).

CREATE TABLE IF NOT EXISTS public.garmin_activity_files (
  id                  bigserial PRIMARY KEY,
  user_id             bigint      NOT NULL,
  activity_id         text        NOT NULL,
  summary_id          text        NOT NULL,
  file_type           text        NOT NULL DEFAULT 'FIT',
  callback_url        text        NOT NULL,
  fit_file_path       text        NULL,     -- Supabase Storage path after download
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'downloading', 'done', 'error')),
  error_message       text        NULL,
  start_time_seconds  bigint      NULL,
  manual              boolean     NOT NULL DEFAULT false,
  downloaded_at       timestamptz NULL,
  parsed_at           timestamptz NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one row per summary_id (idempotent webhook delivery)
ALTER TABLE public.garmin_activity_files
  DROP CONSTRAINT IF EXISTS garmin_activity_files_summary_id_key;
ALTER TABLE public.garmin_activity_files
  ADD CONSTRAINT garmin_activity_files_summary_id_key UNIQUE (summary_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_garmin_activity_files_user_id
  ON public.garmin_activity_files(user_id);

CREATE INDEX IF NOT EXISTS idx_garmin_activity_files_user_activity
  ON public.garmin_activity_files(user_id, activity_id);

CREATE INDEX IF NOT EXISTS idx_garmin_activity_files_status
  ON public.garmin_activity_files(status)
  WHERE status IN ('pending', 'downloading');

-- ─── garmin_activities enrichment ────────────────────────────────────────────
-- Track when an activity was enriched from a FIT file

ALTER TABLE public.garmin_activities
  ADD COLUMN IF NOT EXISTS fit_parsed_at timestamptz NULL;

-- Index for faster FIT enrichment upserts (user_id + activity_id lookup)
CREATE INDEX IF NOT EXISTS idx_garmin_activities_user_activity
  ON public.garmin_activities(user_id, activity_id);

-- ─── RLS Policies ────────────────────────────────────────────────────────────
-- Service role can do everything; authenticated users can only read their own rows.
-- Note: CREATE POLICY IF NOT EXISTS requires PG 15+. Use DROP then CREATE for compatibility.

ALTER TABLE public.garmin_activity_files ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for server-side workers)
DROP POLICY IF EXISTS "service_role_garmin_activity_files" ON public.garmin_activity_files;
CREATE POLICY "service_role_garmin_activity_files"
  ON public.garmin_activity_files
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read their own file records
DROP POLICY IF EXISTS "user_read_own_garmin_activity_files" ON public.garmin_activity_files;
CREATE POLICY "user_read_own_garmin_activity_files"
  ON public.garmin_activity_files
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT user_id FROM public.garmin_tokens WHERE auth_user_id = auth.uid()
    )
  );

-- ─── Supabase Storage bucket ─────────────────────────────────────────────────
-- Create the private bucket for storing raw FIT binaries.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'garmin-fit-files',
    'garmin-fit-files',
    false,
    52428800,
    ARRAY['application/octet-stream', 'application/vnd.ant.fit']
  )
  ON CONFLICT (id) DO NOTHING;

-- Storage RLS: service role can upload/download, authenticated users can read own files
DROP POLICY IF EXISTS "service_role_garmin_fit_files" ON storage.objects;
CREATE POLICY "service_role_garmin_fit_files"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'garmin-fit-files')
  WITH CHECK (bucket_id = 'garmin-fit-files');

DROP POLICY IF EXISTS "user_read_own_garmin_fit_files" ON storage.objects;
CREATE POLICY "user_read_own_garmin_fit_files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'garmin-fit-files'
    AND (storage.foldername(name))[1] IN (
      SELECT user_id::text FROM public.garmin_tokens WHERE auth_user_id = auth.uid()
    )
  );

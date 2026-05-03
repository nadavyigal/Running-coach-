-- Persist browser-created training plans and workouts with stable local IDs.
-- This lets web IndexedDB data be upserted into Supabase and consumed by iOS.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS local_id BIGINT,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS local_id BIGINT,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_distance_km DECIMAL,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS actual_pace INTEGER;

UPDATE public.plans p
SET auth_user_id = pr.auth_user_id
FROM public.profiles pr
WHERE p.profile_id = pr.id
  AND p.auth_user_id IS NULL;

UPDATE public.workouts w
SET auth_user_id = p.auth_user_id
FROM public.plans p
WHERE w.plan_id = p.id
  AND w.auth_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_plans_auth_user_id
  ON public.plans(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_plans_local_id
  ON public.plans(profile_id, local_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_profile_local_id_unique
  ON public.plans(profile_id, local_id)
  WHERE local_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workouts_auth_user_id
  ON public.workouts(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_workouts_local_id
  ON public.workouts(plan_id, local_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_plan_local_id_unique
  ON public.workouts(plan_id, local_id)
  WHERE local_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workouts_completed_at
  ON public.workouts(completed_at);

COMMENT ON COLUMN public.plans.local_id IS 'Original Dexie IndexedDB plan ID for browser-to-Supabase upserts';
COMMENT ON COLUMN public.workouts.local_id IS 'Original Dexie IndexedDB workout ID for browser-to-Supabase upserts';

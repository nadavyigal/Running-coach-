-- Coach Mode, Story 2.2: a coach reads a linked athlete's plan, workouts, and
-- run summaries. Reads go only through these security-definer RPCs. This file
-- does not create a table and does not change a policy on plans, workouts,
-- runs, profiles, wellness_checkins, garmin_*, run_debriefs, or conversations.
--
-- Do not apply this to production from the app PR. Nadav applies
-- 20261117164500_coach_read_rpcs.sql after review. Mirror it to the web repo
-- Running-coach- at v0/supabase/migrations/. Do not apply an older copy.
--
-- Depends on Story 1.3 (coach_athlete_links) and Story 0.2 (runs.workout_id).
--
-- Column names this function body uses, from the web schema migrations and the
-- 2026-11-14 live check (runs.id is bigint, workouts.id is uuid):
--   profiles: auth_user_id uuid, name text, updated_at timestamptz
--   plans: id uuid, profile_id uuid, auth_user_id uuid, title text,
--          start_date date, end_date date, is_active boolean,
--          target_distance numeric, target_time integer
--   workouts: id uuid, plan_id uuid, scheduled_date date, type text,
--             distance numeric, duration integer, pace integer, notes text,
--             completed boolean, completed_at timestamptz,
--             actual_distance_km numeric, actual_duration_minutes integer,
--             actual_pace integer
--   runs: id bigint, auth_user_id uuid, workout_id uuid, completed_at timestamptz,
--         type text, distance numeric, duration integer, pace numeric,
--         heart_rate integer, source_provider text
-- There is no plans.race_date and no profiles.display_name. The athlete's name
-- is profiles.name. Run dates are the UTC date of runs.completed_at, which the
-- app fills with the run's start. workouts.scheduled_date is already a date.
--
-- Idempotent: create or replace, then revoke and grant. No select *.

-- Helpers --------------------------------------------------------------------

-- True only when the signed-in user has an active link to this athlete.
create or replace function public.is_active_coach_of(p_athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.coach_athlete_links l
    where l.coach_id = auth.uid()
      and l.athlete_id = p_athlete
      and l.status = 'active'
  );
$$;

-- profiles.name for an auth user. Blank and missing names become 'Athlete'.
-- Not granted to clients. coach_list_athletes is the only caller.
create or replace function public.athlete_display_name(p_athlete uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(btrim((
      select p.name
      from public.profiles p
      where p.auth_user_id = p_athlete
      order by p.updated_at desc nulls last
      limit 1
    )), ''),
    'Athlete'
  );
$$;

-- RPCs -----------------------------------------------------------------------

create or replace function public.coach_list_athletes()
returns table (
  athlete_id uuid,
  display_name text,
  linked_at timestamptz,
  has_active_plan boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.athlete_id,
    public.athlete_display_name(l.athlete_id),
    l.consented_at,
    exists (
      select 1
      from public.plans p
      where p.is_active
        and (p.auth_user_id = l.athlete_id or p.profile_id = l.athlete_id
         or (p.auth_user_id is null and exists (
           select 1 from public.profiles owner_profile
           where owner_profile.auth_user_id = l.athlete_id
             and owner_profile.id::text = p.profile_id::text
         )))
    )
  from public.coach_athlete_links l
  where l.status = 'active'
    and public.is_active_coach_of(l.athlete_id)
  order by l.consented_at, l.athlete_id;
$$;

-- Active plan only. Empty when the caller is not an active coach of p_athlete.
-- title is the plan name. target_distance and target_time are the goal fields
-- that exist; there is no race date on plans.
create or replace function public.coach_get_athlete_plan(p_athlete uuid)
returns table (
  id uuid,
  athlete_id uuid,
  title text,
  start_date date,
  end_date date,
  target_distance numeric,
  target_time integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p_athlete,
    p.title,
    p.start_date,
    p.end_date,
    p.target_distance,
    p.target_time
  from public.plans p
  where public.is_active_coach_of(p_athlete)
    and p.is_active
    and (p.auth_user_id = p_athlete or p.profile_id = p_athlete
         or (p.auth_user_id is null and exists (
           select 1 from public.profiles owner_profile
           where owner_profile.auth_user_id = p_athlete
             and owner_profile.id::text = p.profile_id::text
         )))
  order by p.start_date desc, p.id;
$$;

-- Workouts on an active plan, scheduled_date inclusive. p_athlete_ids null
-- means every athlete actively linked to the caller. Any other id is ignored.
create or replace function public.coach_get_athletes_workouts(
  p_from date,
  p_to date,
  p_athlete_ids uuid[] default null
)
returns table (
  id uuid,
  athlete_id uuid,
  plan_id uuid,
  scheduled_date date,
  type text,
  planned_distance numeric,
  planned_duration_minutes integer,
  target_pace integer,
  completed boolean,
  completed_at timestamptz,
  actual_distance_km numeric,
  actual_duration_minutes integer,
  actual_pace integer,
  notes text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    w.id,
    l.athlete_id,
    w.plan_id,
    w.scheduled_date,
    w.type,
    w.distance,
    w.duration,
    w.pace,
    w.completed,
    w.completed_at,
    w.actual_distance_km,
    w.actual_duration_minutes,
    w.actual_pace,
    w.notes
  from public.coach_athlete_links l
  join public.plans p
    on p.is_active
   and (p.auth_user_id = l.athlete_id or p.profile_id = l.athlete_id
         or (p.auth_user_id is null and exists (
           select 1 from public.profiles owner_profile
           where owner_profile.auth_user_id = l.athlete_id
             and owner_profile.id::text = p.profile_id::text
         )))
  join public.workouts w
    on w.plan_id = p.id
   and w.scheduled_date between p_from and p_to
  where l.status = 'active'
    and public.is_active_coach_of(l.athlete_id)
    and (p_athlete_ids is null or l.athlete_id = any (p_athlete_ids))
  order by w.scheduled_date, l.athlete_id, w.id;
$$;

-- Run summaries. completed_at is filtered as a UTC date. route and notes are
-- not selected. p_athlete_ids null means every actively linked athlete.
create or replace function public.coach_get_athletes_runs(
  p_from date,
  p_to date,
  p_athlete_ids uuid[] default null
)
returns table (
  id bigint,
  athlete_id uuid,
  workout_id uuid,
  completed_at timestamptz,
  type text,
  distance_km numeric,
  duration_seconds integer,
  pace numeric,
  average_heart_rate integer,
  source text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    l.athlete_id,
    r.workout_id,
    r.completed_at,
    r.type,
    r.distance::numeric,
    r.duration::integer,
    r.pace::numeric,
    r.heart_rate::integer,
    r.source_provider
  from public.coach_athlete_links l
  join public.runs r
    on r.auth_user_id = l.athlete_id
   and (r.completed_at at time zone 'utc')::date between p_from and p_to
  where l.status = 'active'
    and public.is_active_coach_of(l.athlete_id)
    and (p_athlete_ids is null or l.athlete_id = any (p_athlete_ids))
  order by r.completed_at, l.athlete_id, r.id;
$$;

revoke all on function public.is_active_coach_of(uuid) from public, anon;
revoke all on function public.athlete_display_name(uuid) from public, anon, authenticated;
revoke all on function public.coach_list_athletes() from public, anon;
revoke all on function public.coach_get_athlete_plan(uuid) from public, anon;
revoke all on function public.coach_get_athletes_workouts(date, date, uuid[]) from public, anon;
revoke all on function public.coach_get_athletes_runs(date, date, uuid[]) from public, anon;

grant execute on function public.is_active_coach_of(uuid) to authenticated;
grant execute on function public.coach_list_athletes() to authenticated;
grant execute on function public.coach_get_athlete_plan(uuid) to authenticated;
grant execute on function public.coach_get_athletes_workouts(date, date, uuid[]) to authenticated;
grant execute on function public.coach_get_athletes_runs(date, date, uuid[]) to authenticated;

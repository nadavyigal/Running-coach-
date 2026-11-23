-- Coach Experience v2, story C7.6: evening summary with counts.
-- Batch B, after M2b.
--
-- Do not apply this to production from the app PR. Nadav applies
-- 20261122120000_workout_adherence_state.sql himself, in Batch B, after M2a
-- (20261122100000_push_tokens_and_prefs.sql) and M2b
-- (20261122110000_notification_log_and_deferred.sql), before the
-- coach_evening_summary deploy and its hourly cron
-- (docs/coach-v2-batch-b-runbook.md). Mirror it to the web repo Running-coach- at
-- v0/supabase/migrations/. Do not apply an older copy.
--
-- "Coach" here means a HUMAN coach (Coach Mode). It is unrelated to the AI coach
-- (coach_message, coaching_style).
--
-- The plan lists C7.6 as "Mig: none", but AC6 asks for a shared SQL function
-- (workout_adherence_state) that matches the Swift WorkoutAdherence, and a SQL
-- function needs a migration. This file adds only functions: no table, no column,
-- no policy, no row.
--
-- Depends on: Story 1.3 (coach_athlete_links), M0 (link_is_v2), M5a
-- (coach_v2_sharing_allowed), M3 (coach_athlete_events), C7.4
-- (athlete_run_flags), M2a (notification_prefs), and the app tables plans,
-- workouts, runs and profiles.
--
-- What this file creates (all server-only: no client role can execute them; only
-- service_role, which the coach_evening_summary Edge Function uses):
--   workout_adherence_boundary(p_now, p_time_zone)
--       The Swift WorkoutAdherence.missedBoundary: the local date of p_now in
--       p_time_zone, or the next date once the local time is 20:00 or later. A
--       workout dated before the boundary with no run is missed. An unknown zone
--       is read as UTC (like notify.ts localMinutes).
--   workout_adherence_state(type, planned km, planned minutes, scheduled date,
--       run km, run seconds, boundary)
--       The Swift WorkoutAdherence rules for one workout and at most one run that
--       belongs to it: 'rest' (type rest, never counted), 'extra' (a run with no
--       workout), 'missed' / 'planned' (no run, dated before / not before the
--       boundary), 'done' / 'partial' (the 80% rule: planned distance when set,
--       otherwise planned duration, otherwise done). The caller decides which run
--       belongs to the workout, as the Swift callers do.
--   coach_evening_summary_counts(p_coach, p_day, p_time_zone, p_now)
--       The three numbers of the 20:00 push (C7.6 AC1), over the coach's active
--       links that are v2 and sharing-allowed (AC7: revoked, not-v2, not-acked
--       and kill-switch links count as nothing). Counts only: never a name.
--         missed       athletes with a non-rest workout on p_day, in their active
--                      plan, that was not at least 80% done by 20:00 on p_day in
--                      the athlete's zone (their notification_prefs.time_zone,
--                      else the coach's). Missed and partial both count. An
--                      athlete whose 20:00 has not come yet at p_now is not
--                      counted.
--         open_flags   open (unresolved) athlete_run_flags on those links, now.
--         plan_changes distinct athletes with a goal_change, athlete_skip or
--                      athlete_move event for this coach on p_day in the coach's
--                      zone, up to 20:00 (or p_now when earlier).
--       Missed and plan changes are fixed once 20:00 has passed, so a summary
--       held through quiet hours and recounted the next morning says the same
--       about that day; open flags are read at send time.
--
-- Idempotent: every function is create or replace, grants are restated.
--
-- Rollback: supabase/rollback/20261122120000_workout_adherence_state.sql (drops
-- the three functions; there is no data). Runbook: docs/coach-v2-rollback.md.

-- Adherence (C7.6 AC6) ----------------------------------------------------------

create or replace function public.workout_adherence_boundary(p_now timestamptz, p_time_zone text)
returns date
language sql
stable
set search_path = ''
as $$
  with zone as (
    select case
      when exists (select 1 from pg_catalog.pg_timezone_names n where n.name = p_time_zone) then p_time_zone
      else 'UTC'
    end as tz
  ),
  local_now as (
    select (p_now at time zone zone.tz) as at from zone
  )
  select case
    when extract(hour from local_now.at) >= 20 then (local_now.at::date + 1)
    else local_now.at::date
  end
  from local_now;
$$;

create or replace function public.workout_adherence_state(
  p_type text,
  p_planned_distance numeric,
  p_planned_duration_minutes integer,
  p_scheduled_date date,
  p_run_distance_km numeric,
  p_run_duration_seconds integer,
  p_boundary date
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    -- No workout: a run on its own is an extra run.
    when p_type is null then
      case when p_run_distance_km is not null or p_run_duration_seconds is not null then 'extra' end
    -- Rest rows are not workouts to complete (WorkoutAdherence.counts).
    when lower(btrim(p_type, E' \t')) = 'rest' then 'rest'
    -- No run.
    when p_run_distance_km is null and p_run_duration_seconds is null then
      case when p_scheduled_date < p_boundary then 'missed' else 'planned' end
    -- The 80% rule (WorkoutAdherence.measure).
    when coalesce(p_planned_distance, 0) > 0 then
      case when coalesce(p_run_distance_km, 0) >= p_planned_distance * 0.8 then 'done' else 'partial' end
    when coalesce(p_planned_duration_minutes, 0) > 0 then
      case
        when coalesce(p_run_duration_seconds, 0) >= p_planned_duration_minutes * 60 * 0.8 then 'done'
        else 'partial'
      end
    else 'done'
  end;
$$;

-- Evening summary counts (C7.6 AC1, AC2, AC7) -------------------------------------

create or replace function public.coach_evening_summary_counts(
  p_coach uuid,
  p_day date,
  p_time_zone text,
  p_now timestamptz default now()
)
returns table (missed integer, open_flags integer, plan_changes integer)
language sql
stable
security definer
set search_path = ''
as $$
  with coach_zone as (
    select case
      when exists (select 1 from pg_catalog.pg_timezone_names n where n.name = p_time_zone) then p_time_zone
      else 'UTC'
    end as tz
  ),
  -- AC7: active, v2 and sharing-allowed. coach_v2_sharing_allowed includes
  -- link_is_v2, so the coach_v2 kill switch empties this list.
  eligible as (
    select
      l.id as link_id,
      l.athlete_id,
      coalesce(
        (select np.time_zone
         from public.notification_prefs np
         where np.user_id = l.athlete_id
           and exists (select 1 from pg_catalog.pg_timezone_names n where n.name = np.time_zone)),
        (select tz from coach_zone)
      ) as tz
    from public.coach_athlete_links l
    where l.coach_id = p_coach
      and l.status = 'active'
      and public.coach_v2_sharing_allowed(l.coach_id, l.athlete_id)
  ),
  -- The 20:00 cutoff on p_day in each athlete's zone. Only athletes whose cutoff
  -- has passed at p_now are counted, and runs after the cutoff do not count.
  cutoff as (
    select e.*, (p_day + time '20:00') at time zone e.tz as as_of
    from eligible e
    where (p_day + time '20:00') at time zone e.tz <= p_now
  ),
  -- Non-rest workouts on p_day in the athlete's active plan (the plan lookup of
  -- coach_get_athletes_workouts).
  day_workouts as (
    select
      c.athlete_id,
      c.tz,
      c.as_of,
      public.workout_adherence_boundary(c.as_of, c.tz) as boundary,
      w.id,
      w.type,
      w.distance,
      w.duration,
      w.completed,
      w.scheduled_date
    from cutoff c
    join public.plans p
      on p.is_active
     and (p.auth_user_id = c.athlete_id or p.profile_id = c.athlete_id
           or (p.auth_user_id is null and exists (
             select 1 from public.profiles owner_profile
             where owner_profile.auth_user_id = c.athlete_id
               and owner_profile.id::text = p.profile_id::text
           )))
    join public.workouts w
      on w.plan_id = p.id
     and w.scheduled_date = p_day
    where lower(btrim(w.type, E' \t')) <> 'rest'
  ),
  states as (
    select
      dw.athlete_id,
      coalesce(
        -- Runs linked to the workout, up to the cutoff: any done run wins
        -- (WorkoutAdherence.state).
        (select case
                  when bool_or(public.workout_adherence_state(
                    dw.type, dw.distance, dw.duration, dw.scheduled_date,
                    r.distance::numeric, r.duration::integer, dw.boundary) = 'done') then 'done'
                  else 'partial'
                end
         from public.runs r
         where r.workout_id = dw.id
           and r.auth_user_id = dw.athlete_id
           and r.completed_at <= dw.as_of
         having count(*) > 0),
        -- "Matched by date" (CoachAthleteDays): a workout marked completed that no
        -- run links to takes the first unlinked run of that day.
        (select public.workout_adherence_state(
                  dw.type, dw.distance, dw.duration, dw.scheduled_date,
                  r.distance::numeric, r.duration::integer, dw.boundary)
         from public.runs r
         where dw.completed
           and r.workout_id is null
           and r.auth_user_id = dw.athlete_id
           and r.completed_at <= dw.as_of
           and (r.completed_at at time zone dw.tz)::date = dw.scheduled_date
           and not exists (
             select 1 from public.runs linked
             where linked.workout_id = dw.id and linked.completed_at <= dw.as_of
           )
         order by r.completed_at, r.id
         limit 1),
        public.workout_adherence_state(
          dw.type, dw.distance, dw.duration, dw.scheduled_date, null, null, dw.boundary)
      ) as state
    from day_workouts dw
  )
  select
    (select count(distinct s.athlete_id)::integer from states s where s.state in ('missed', 'partial')),
    (select count(*)::integer
     from eligible e
     join public.athlete_run_flags f
       on f.link_id = e.link_id
      and f.athlete_id = e.athlete_id
     where f.resolved_at is null),
    (select count(distinct ev.athlete_id)::integer
     from eligible e
     join public.coach_athlete_events ev
       on ev.athlete_id = e.athlete_id
      and ev.coach_id = p_coach
     cross join coach_zone z
     where ev.kind in ('goal_change', 'athlete_skip', 'athlete_move')
       and ev.created_at >= (p_day::timestamp at time zone z.tz)
       and ev.created_at < least(p_now, (p_day + time '20:00') at time zone z.tz));
$$;

-- Function grants: service_role only -------------------------------------------------

revoke all on function public.workout_adherence_boundary(timestamptz, text) from public, anon, authenticated;
revoke all on function public.workout_adherence_state(text, numeric, integer, date, numeric, integer, date)
  from public, anon, authenticated;
revoke all on function public.coach_evening_summary_counts(uuid, date, text, timestamptz)
  from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.workout_adherence_boundary(timestamptz, text) to service_role;
    grant execute on function public.workout_adherence_state(text, numeric, integer, date, numeric, integer, date)
      to service_role;
    grant execute on function public.coach_evening_summary_counts(uuid, date, text, timestamptz) to service_role;
  end if;
end $$;

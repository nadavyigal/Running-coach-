-- Commit the run link and completion actuals in one transaction.
-- Apply after 20261114130000_runs_workout_link, before releasing the updated app.
-- Mirror this file into Running-coach-/v0/supabase/migrations/.
create or replace function public.complete_run_workout(
  p_expected_athlete uuid,
  p_workout_id uuid,
  p_source_provider text,
  p_source_activity_id text,
  p_completed_at timestamptz,
  p_actual_distance_km numeric,
  p_actual_duration_minutes integer,
  p_actual_pace integer default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  athlete_id uuid := auth.uid();
  workout_completed boolean;
  run_id bigint;
  linked_workout_id uuid;
begin
  -- A retry captured for an earlier app session cannot act under the new session.
  if athlete_id is null or athlete_id is distinct from p_expected_athlete then
    return 'not_available';
  end if;

  -- Lock the workout first, so competing runs cannot both reserve it. Both
  -- table operations also run under the caller's existing owner policies.
  select w.completed into workout_completed
  from public.workouts w
  where w.id = p_workout_id
    and exists (
      select 1 from public.plans p
      where p.id = w.plan_id and p.is_active
        and (w.auth_user_id = athlete_id or p.auth_user_id = athlete_id)
    )
  for update;
  if not found then
    return 'not_available';
  end if;

  select r.id, r.workout_id into run_id, linked_workout_id
  from public.runs r
  where r.auth_user_id = athlete_id
    and r.source_provider = p_source_provider
    and r.source_activity_id = p_source_activity_id
  for update;
  if not found then
    if workout_completed then
      return 'not_available';
    end if;
    return 'run_not_synced';
  end if;

  if workout_completed then
    if linked_workout_id = p_workout_id then
      return 'already_completed';
    end if;
    return 'not_available';
  end if;
  if linked_workout_id is not null and linked_workout_id <> p_workout_id then
    return 'not_available';
  end if;

  -- The partial unique index is also enforced for callers on older builds.
  -- A competing link must leave this workout's actuals untouched.
  if linked_workout_id is null then
    begin
      update public.runs set workout_id = p_workout_id
      where id = run_id and auth_user_id = athlete_id;
      if not found then
        return 'not_available';
      end if;
    exception when unique_violation then
      return 'not_available';
    end;
  end if;

  update public.workouts set
    completed = true,
    completed_at = p_completed_at,
    actual_distance_km = p_actual_distance_km,
    actual_duration_minutes = p_actual_duration_minutes,
    actual_pace = p_actual_pace
  where id = p_workout_id;
  if not found then
    -- Abort the whole statement if the workout update is filtered by a policy.
    raise exception 'Workout completion became unavailable' using errcode = '42501';
  end if;

  return 'completed';
end
$$;

revoke all on function public.complete_run_workout(uuid, uuid, text, text, timestamptz, numeric, integer, integer) from public, anon;
grant execute on function public.complete_run_workout(uuid, uuid, text, text, timestamptz, numeric, integer, integer) to authenticated;

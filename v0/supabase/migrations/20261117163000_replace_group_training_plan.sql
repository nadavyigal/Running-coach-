-- Story 1.8. Mirror in the web migration tree before rollout.
create or replace function public.replace_group_training_plan(
  expected_athlete uuid, new_plan jsonb, new_workouts jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  athlete uuid := auth.uid();
  plan_row public.plans%rowtype;
  new_plan_id uuid;
begin
  if athlete is null or athlete is distinct from expected_athlete then
    raise exception 'Plan replacement requires the confirming athlete' using errcode = '42501';
  end if;
  if jsonb_typeof(new_workouts) is distinct from 'array' then
    raise exception 'Workouts must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(new_workouts) = 0 then
    raise exception 'A replacement plan requires workouts' using errcode = '22023';
  end if;

  -- Existing owner RLS applies. Serialize concurrent group replacements.
  perform pg_advisory_xact_lock(hashtextextended(athlete::text, 18));
  plan_row := jsonb_populate_record(null::public.plans, new_plan);
  update public.plans
  set is_active = false
  where is_active and (
    auth_user_id = athlete
    or (auth_user_id is null and profile_id = plan_row.profile_id)
  );

  insert into public.plans (
    profile_id, auth_user_id, title, description, start_date, end_date,
    total_weeks, is_active, plan_type, training_days_per_week, target_distance,
    target_time, peak_weekly_volume
  ) values (
    plan_row.profile_id, athlete, plan_row.title, plan_row.description,
    plan_row.start_date, plan_row.end_date, plan_row.total_weeks, true,
    plan_row.plan_type, plan_row.training_days_per_week, plan_row.target_distance,
    plan_row.target_time, plan_row.peak_weekly_volume
  )
  returning id into new_plan_id;

  insert into public.workouts (
    plan_id, auth_user_id, week, day, type, distance, duration, pace,
    completed, scheduled_date, notes, workout_structure, intensity, training_phase
  )
  select
    new_plan_id, athlete, w.week, w.day, w.type, w.distance, w.duration, w.pace,
    false, w.scheduled_date, w.notes, w.workout_structure, w.intensity, w.training_phase
  from jsonb_populate_recordset(null::public.workouts, new_workouts) w;
end
$$;

revoke all on function public.replace_group_training_plan(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.replace_group_training_plan(uuid, jsonb, jsonb) to authenticated;

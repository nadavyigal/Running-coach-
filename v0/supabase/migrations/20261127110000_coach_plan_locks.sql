-- Coach Experience v2, story C8.1b: the plans lock trigger, the athlete RPCs and
-- lock release when a coach link ends. M6b, Batch C.
--
-- File name: reserved as 20261201110000 in the ledger. Renamed (unapplied) to
-- 20261127110000 because scripts/check_migrations.py rejects a timestamp more
-- than 24h in the future. It sorts right after M6a (20261127100000).
--
-- Do not apply this to production from the app PR. Nadav applies Batch C
-- (20261127100000_coach_workout_locks.sql, then this file) together, at a quiet
-- time, after a read-only audit, with both rollback files ready. Mirror it to the
-- web repo Running-coach- at v0/supabase/migrations/. Do not apply an older copy.
--
-- "Coach" here means a HUMAN coach (Coach Mode). It is unrelated to the AI coach
-- (coach_message, coaching_style).
--
-- Depends on: M6a (workouts lock columns, workouts_protect_coach_rows,
-- coach_athlete_today), M5b (end_coach_link, which this file replaces), M3
-- (coach_athlete_events with the athlete_skip / athlete_move / goal_change kinds
-- and the (athlete_id, client_id) unique index), C7.0 (link_is_v2) and Story 1.8
-- (replace_group_training_plan, which this file replaces). plans and workouts are
-- created by the web repo.
--
-- What this file creates or changes:
--   plans columns                 coach_published, coach_id. Constant defaults
--                                 only, so existing plans read coach_published =
--                                 false with no per-row update.
--   plans_protect_coach_plans     BEFORE INSERT/UPDATE/DELETE trigger on plans.
--                                 A non-coach writer cannot set coach_published or
--                                 coach_id, and cannot deactivate or delete a plan
--                                 that is coach-published (plan_locked_by_coach)
--                                 or that has locked future workouts
--                                 (coach_workouts_present, unless
--                                 runsmart.goal_change is on).
--   coach_plan_locked_future_count(p_plan)   locked workouts dated today or later
--                                 (athlete's time zone) on one plan. Used by the
--                                 trigger and the two replace RPCs. Returns 0 for a
--                                 plan the signed-in caller does not own.
--   coach_release_athlete_locks(p_athlete)   internal. Unlocks the athlete's
--                                 future workouts and clears coach_published on
--                                 their plans. The rows stay (G17).
--   athlete_replace_training_plan  athlete write (D2). Replaces the active plan
--                                 when the athlete acknowledged how many coach
--                                 workouts it removes; logs goal_change.
--   athlete_request_seen(p_athlete, p_request_id)   internal. The idempotency
--                                 lookup on coach_athlete_events.
--   athlete_change_coach_workout   athlete write (D1). Skip or move one coach
--                                 workout; the row stays locked; logs
--                                 athlete_skip / athlete_move; a repeated
--                                 p_request_id is a no-op.
--   end_coach_link                 create or replace. Everything M5b does, plus
--                                 the lock release, in the same transaction.
--   coach_links_release_locks_on_delete   AFTER DELETE trigger on
--                                 coach_athlete_links. Account deletion
--                                 (purge_coach_data_for_deleted_account, or an FK
--                                 cascade) deletes links without end_coach_link;
--                                 this releases the locks on that path too.
--   leave_coach, coach_remove_athlete   create or replace, same signatures and
--                                 M5b bodies, plus FOR KEY SHARE on both auth.users
--                                 rows before the link lock (lock order 0, 1).
--   replace_group_training_plan    create or replace, same signature, security
--                                 invoker as before. Same behavior, plus a clear
--                                 error before it touches anything when the active
--                                 plan is coach-published or has locked future
--                                 workouts. 20261117163000 is not edited.
--
-- Trust rule, the same as M6a: runsmart.coach_write and runsmart.goal_change
-- count only when current_user is not a client role (authenticated / anon), that
-- is, inside a security definer function owned by the migration role, or Nadav's
-- owner-only SQL. A client cannot run set_config through PostgREST, and even if
-- one found a way, its own role makes the trigger ignore it.
--
-- Which deletes pass the plans trigger: FK cascades (an auth user being deleted
-- runs the plan delete one trigger level down) and the service role
-- (delete_account deletes plans directly). Account deletion is never blocked.
--
-- Errors (raise ... using errcode). The client maps the message:
--   not authenticated         42501
--   plan_locked_by_coach      P0001  the plan is coach-published (P5 block)
--   coach_workouts_present    P0001  the plan has locked future workouts; use
--                                    athlete_replace_training_plan
--   count_changed             P0001  p_ack_replaced_count is not the current count
--                                    (detail = the current count)
--   workout_not_found         P0002  no such workout on the caller's plans
--   workout_not_locked        P0001  the row is not a locked coach workout
--   link_inactive             P0001  the athlete has no active coach link
--   v2_unavailable            P0001  link_is_v2 is false (kill switch, old build)
--   workout_not_editable      P0001  completed, dated before the athlete's today,
--                                    or a move to a past date
--   date_taken                P0001  the move target day already has a workout
--   invalid_workout           22023  move date more than 366 days ahead, or the
--                                    same day
--   invalid_action            22023  p_action is not 'skip' or 'move'
--   bad_request_id            22023  p_request_id is null
--   invalid_ack_count         22023  p_ack_replaced_count null or negative
--   (replace RPCs keep Story 1.8's 42501 / 22023 messages for bad input)
--
-- Idempotent: columns are "if not exists", functions are create or replace,
-- triggers are dropped and recreated, grants are restated.
--
-- Rollback: supabase/rollback/20261127110000_coach_plan_locks.sql (restores the
-- M5b end_coach_link and the Story 1.8 replace_group_training_plan, drops the
-- triggers and the new functions, keeps the plans columns and their values).
-- Runbook: docs/coach-v2-rollback.md. Writer list: docs/coach-v2-writers.md.

-- plans columns -----------------------------------------------------------------

alter table public.plans
  add column if not exists coach_published boolean not null default false,
  add column if not exists coach_id uuid references auth.users(id) on delete set null;

-- Internal helpers ----------------------------------------------------------------

-- Locked workouts dated on or after the plan owner's today. Volatile, so every
-- call reads with a fresh snapshot (a deactivation that waited on a coach write
-- counts the row that write committed; race case 5). Security definer so
-- the trigger (which runs as the client) can use coach_athlete_today. A signed-in
-- caller learns the count only for a plan they own (the plans RLS predicate);
-- every other plan reads 0. With no auth.uid() (service role, owner SQL) it counts.
create or replace function public.coach_plan_locked_future_count(p_plan uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_plan record;
  v_count integer;
begin
  select p.id, p.auth_user_id, p.profile_id, p.created_in_timezone
    into v_plan
  from public.plans p
  where p.id = p_plan;
  if not found then
    return 0;
  end if;
  if v_uid is not null
     and v_plan.auth_user_id is distinct from v_uid
     and v_plan.profile_id is distinct from v_uid then
    return 0;
  end if;

  select count(*) into v_count
  from public.workouts w
  where w.plan_id = p_plan
    and w.locked
    and w.scheduled_date >= public.coach_athlete_today(
          coalesce(v_plan.auth_user_id, v_plan.profile_id), v_plan.created_in_timezone);
  return v_count;
end;
$$;

-- Unlocks every locked workout dated on or after the athlete's today on the
-- athlete's plans, and clears coach_published on those plans. Rows stay, with
-- their source and coach_id (G17: "Your plan stays"). Past locked rows stay as
-- they are: they block nothing (the plans trigger counts only future rows).
-- Returns the number of workouts unlocked. Restores the caller's coach_write
-- setting afterwards. Not callable by clients.
create or replace function public.coach_release_athlete_locks(p_athlete uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('runsmart.coach_write', true), '');
  v_rows integer := 0;
begin
  if p_athlete is null then
    return 0;
  end if;

  -- M6a LOCK ORDER (0 auth users, 1 link, 2 plan, 3 workout, 4 advisory): the
  -- caller already holds lock 1 (end_coach_link updated the link; the link delete
  -- trigger runs on its delete). Lock 2: the athlete's plans FOR UPDATE. Lock 3:
  -- the workouts, by the UPDATE below. No advisory lock.
  perform 1 from public.plans p
  where p.auth_user_id = p_athlete or p.profile_id = p_athlete
  for update of p;

  perform set_config('runsmart.coach_write', 'on', true);

  update public.workouts w
  set locked = false
  from public.plans p
  where p.id = w.plan_id
    and w.locked
    and (p.auth_user_id = p_athlete or p.profile_id = p_athlete)
    and w.scheduled_date >= public.coach_athlete_today(p_athlete, p.created_in_timezone);
  get diagnostics v_rows = row_count;

  update public.plans p
  set coach_published = false
  where p.coach_published
    and (p.auth_user_id = p_athlete or p.profile_id = p_athlete);

  perform set_config('runsmart.coach_write', v_prev, true);
  return v_rows;
end;
$$;

-- The plans lock trigger ---------------------------------------------------------------

-- Security invoker on purpose, like workouts_protect_coach_rows: it reads OLD/NEW,
-- two settings and the role, and counts through the definer helper above.
create or replace function public.plans_protect_coach_plans()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_trusted boolean := current_user not in ('authenticated', 'anon');
  v_coach_write boolean := v_trusted
    and coalesce(current_setting('runsmart.coach_write', true), '') = 'on';
  v_goal_change boolean := v_trusted
    and coalesce(current_setting('runsmart.goal_change', true), '') = 'on';
begin
  if v_coach_write then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A non-coach writer can never create a coach-published plan.
    new.coach_published := false;
    new.coach_id := null;
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- FK cascades (an auth user being deleted) arrive one trigger level down and
    -- pass. So does the service role: delete_account deletes plans directly and
    -- must never be blocked.
    if pg_trigger_depth() >= 2 or current_user = 'service_role' then
      return old;
    end if;
    if old.coach_published then
      raise exception 'plan_locked_by_coach' using errcode = 'P0001';
    end if;
    -- An inactive plan (for example one replaced by athlete_replace_training_plan)
    -- can be cleaned up even with locked rows: the coach's live workouts are on
    -- the active plan. A published plan stays protected either way.
    if old.is_active and not v_goal_change
       and public.coach_plan_locked_future_count(old.id) > 0 then
      raise exception 'coach_workouts_present' using errcode = 'P0001';
    end if;
    return old;
  end if;

  -- UPDATE. The coach columns always come from OLD for a non-coach writer, except
  -- a referential action: plans.coach_id is ON DELETE SET NULL, so deleting a
  -- coach's auth user runs an UPDATE here one trigger level down, which must keep
  -- the null (the same rule as M6a's workouts.coach_id).
  if not (pg_trigger_depth() > 1 and new.coach_id is null) then
    new.coach_id := old.coach_id;
  end if;
  new.coach_published := old.coach_published;

  -- Deactivation (persistGeneratedPlan, the web plan upsert, replace RPCs).
  if old.is_active and new.is_active is distinct from true then
    if old.coach_published then
      raise exception 'plan_locked_by_coach' using errcode = 'P0001';
    end if;
    if not v_goal_change and public.coach_plan_locked_future_count(old.id) > 0 then
      raise exception 'coach_workouts_present' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists plans_protect_coach_plans on public.plans;
create trigger plans_protect_coach_plans
  before insert or update or delete on public.plans
  for each row execute function public.plans_protect_coach_plans();

-- athlete_replace_training_plan (D2) ------------------------------------------------------

-- The linked athlete's plan regeneration (persistGeneratedPlan moves here in C8.5).
-- Same input shape as replace_group_training_plan. The client first shows how
-- many coach workouts the new plan replaces and passes that count; if it changed
-- meanwhile, count_changed and nothing changes. A coach-published plan is never
-- replaced here (plan_locked_by_coach). Returns the new plan id.
--
-- Not gated on link_is_v2: with the kill switch on, an athlete with locked rows
-- must still be able to regenerate [ASSUMPTION]. The goal_change event is logged
-- whenever the athlete has an active link.
create or replace function public.athlete_replace_training_plan(
  expected_athlete uuid,
  new_plan jsonb,
  new_workouts jsonb,
  p_ack_replaced_count integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_new_plan uuid;
  v_count integer;
  v_coach uuid;
  v_prev text;
begin
  if v_uid is null or v_uid is distinct from expected_athlete then
    raise exception 'Plan replacement requires the confirming athlete' using errcode = '42501';
  end if;
  if jsonb_typeof(new_plan) is distinct from 'object' then
    raise exception 'Plan must be an object' using errcode = '22023';
  end if;
  if jsonb_typeof(new_workouts) is distinct from 'array' then
    raise exception 'Workouts must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(new_workouts) = 0 then
    raise exception 'A replacement plan requires workouts' using errcode = '22023';
  end if;
  if jsonb_array_length(new_workouts) > 500 then
    raise exception 'Too many workouts' using errcode = '22023';
  end if;
  if p_ack_replaced_count is null or p_ack_replaced_count < 0 then
    raise exception 'invalid_ack_count' using errcode = '22023';
  end if;

  -- M6a LOCK ORDER (0 auth users, 1 link, 2 plan, 3 workout, 4 advisory):
  -- 0 the auth.users rows of the athlete and the active coach, FOR KEY SHARE (the
  -- plan, workout and goal_change inserts check foreign keys to them, and a coach
  -- account delete holds the coach's row while its cascade locks this athlete's
  -- plans), 1 the active link FOR SHARE, 2 the active plans FOR UPDATE. No
  -- existing workout is locked (3): only new rows are inserted.
  -- One exception, kept from Story 1.8: the replace advisory lock (key 18) comes
  -- between 1 and 2, as in replace_group_training_plan. Only the two replace
  -- functions take key 18, and both take it before any plan lock, so it cannot
  -- form a cycle.
  select l.coach_id into v_coach
  from public.coach_athlete_links l
  where l.athlete_id = v_uid and l.status = 'active';
  perform 1 from auth.users u where u.id in (v_uid, v_coach) for key share of u;
  if v_coach is not null then
    select l.coach_id into v_coach
    from public.coach_athlete_links l
    where l.athlete_id = v_uid and l.status = 'active' and l.coach_id = v_coach
    for share of l;
    -- Not found: the link ended while this call waited. Replace as a solo
    -- athlete; no goal_change event (v_coach is null).
  end if;

  -- Same key as replace_group_training_plan: the two replace paths serialize.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 18));

  -- Lock 2: the active plans, before counting. A coach write holds its plan FOR
  -- SHARE (M6a lock order), so it either commits first and is counted, or waits,
  -- re-checks is_active and finds the plan gone. The count cannot go stale.
  perform 1 from public.plans p
  where p.is_active and (p.auth_user_id = v_uid or p.profile_id = v_uid)
  for update of p;

  if exists (
    select 1 from public.plans p
    where p.is_active and p.coach_published
      and (p.auth_user_id = v_uid or p.profile_id = v_uid)
  ) then
    raise exception 'plan_locked_by_coach' using errcode = 'P0001';
  end if;

  select coalesce(sum(public.coach_plan_locked_future_count(p.id)), 0)::integer
    into v_count
  from public.plans p
  where p.is_active
    and (p.auth_user_id = v_uid or p.profile_id = v_uid);
  if v_count <> p_ack_replaced_count then
    raise exception 'count_changed' using errcode = 'P0001', detail = v_count::text;
  end if;

  v_prev := coalesce(current_setting('runsmart.goal_change', true), '');
  perform set_config('runsmart.goal_change', 'on', true);
  update public.plans p
  set is_active = false
  where p.is_active
    and (p.auth_user_id = v_uid or p.profile_id = v_uid);
  perform set_config('runsmart.goal_change', v_prev, true);

  -- The owner columns come from the session, never from the payload (this
  -- function bypasses the plans RLS, whose check is auth_user_id = profile_id =
  -- auth.uid()). A legacy numeric profile_id in the payload is ignored.
  v_plan := jsonb_populate_record(
    null::public.plans,
    new_plan - 'id' - 'profile_id' - 'auth_user_id' - 'is_active' - 'coach_published' - 'coach_id');

  insert into public.plans (
    profile_id, auth_user_id, title, description, start_date, end_date,
    total_weeks, is_active, plan_type, training_days_per_week, target_distance,
    target_time, peak_weekly_volume
  ) values (
    v_uid, v_uid, v_plan.title, v_plan.description,
    v_plan.start_date, v_plan.end_date, v_plan.total_weeks, true,
    coalesce(v_plan.plan_type, 'basic'), v_plan.training_days_per_week, v_plan.target_distance,
    v_plan.target_time, v_plan.peak_weekly_volume
  )
  returning id into v_new_plan;

  -- The workouts trigger resets every lock column on these inserts.
  insert into public.workouts (
    plan_id, auth_user_id, week, day, type, distance, duration, pace,
    completed, scheduled_date, notes, workout_structure, intensity, training_phase
  )
  select
    v_new_plan, v_uid, w.week, w.day, w.type, w.distance, w.duration, w.pace,
    false, w.scheduled_date, w.notes, w.workout_structure, w.intensity, w.training_phase
  from jsonb_populate_recordset(null::public.workouts, new_workouts) w;

  -- v_coach is the link locked above (null when there is none).
  if v_coach is not null then
    insert into public.coach_athlete_events (coach_id, athlete_id, kind, ref_id)
    values (v_coach, v_uid, 'goal_change', v_new_plan);
  end if;

  return v_new_plan;
end;
$$;

-- athlete_change_coach_workout (D1) ---------------------------------------------------------

-- True when this athlete already logged an event with this client id. Each call
-- is its own statement, so under READ COMMITTED it sees events committed by a
-- concurrent request while the caller waited on a lock.
create or replace function public.athlete_request_seen(p_athlete uuid, p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.coach_athlete_events e
    where e.athlete_id = p_athlete and e.client_id = p_request_id
  );
$$;

-- The athlete skips or moves one coach workout. Only scheduled_date (with its
-- derived day and week), original_date (first move only), athlete_change and
-- athlete_changed_at change; the row stays locked (M6a's trigger enforces it on
-- the runsmart.athlete_change path). Logs athlete_skip / athlete_move with
-- ref_id = the workout and client_id = p_request_id, which the coach sees in-app
-- only (C7.2 marker, C7.6 count); no push.
-- Returns 'changed', or 'duplicate' when p_request_id was already used (a no-op,
-- checked first so an outbox retry after the link ended still succeeds).
-- A move to a day that has any workout raises date_taken (spec B.6, one workout
-- per day, as M6a's coach move), AI or coach (founder decision 2026-11-27).
create or replace function public.athlete_change_coach_workout(
  p_id uuid,
  p_action text,
  p_new_date date default null,
  p_request_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_w record;
  v_coach uuid;
  v_today date;
  v_prev text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('skip', 'move') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  if p_request_id is null then
    raise exception 'bad_request_id' using errcode = '22023';
  end if;

  -- Idempotency fast path, before any lock or check: an outbox retry of a
  -- request that already landed returns 'duplicate', even after the link ended.
  if public.athlete_request_seen(v_uid, p_request_id) then
    return 'duplicate';
  end if;

  -- M6a LOCK ORDER: 0 the auth.users rows of the athlete and the
  -- coach (FOR KEY SHARE: the event insert below needs them for its foreign keys,
  -- and a coach account delete holds the coach's row while its cascade locks
  -- plans; taking them first means the two wait instead of deadlocking), 1 the
  -- active link (FOR SHARE, so a concurrent link end waits and then releases this
  -- row), 2 the plan, 3 the workout, 4 advisory locks.
  select l.coach_id into v_coach
  from public.coach_athlete_links l
  where l.athlete_id = v_uid and l.status = 'active';
  perform 1 from auth.users u where u.id in (v_uid, v_coach) for key share of u;

  select l.coach_id into v_coach
  from public.coach_athlete_links l
  where l.athlete_id = v_uid and l.status = 'active'
    and l.coach_id = v_coach
  for share of l;
  if not found then
    -- A retry of a request that landed while this call waited (the original
    -- committed, then the link ended) is still a no-op, not an error.
    if public.athlete_request_seen(v_uid, p_request_id) then
      return 'duplicate';
    end if;
    raise exception 'link_inactive' using errcode = 'P0001';
  end if;

  -- Only workouts on the athlete's active plan: rows left on a plan replaced by
  -- athlete_replace_training_plan cannot be skipped or moved.
  perform 1 from public.plans p
  join public.workouts w on w.plan_id = p.id
  where w.id = p_id and p.is_active and (p.auth_user_id = v_uid or p.profile_id = v_uid)
  for share of p;

  select w.id, w.plan_id, w.scheduled_date, w.completed, w.locked,
         p.start_date as plan_start, p.created_in_timezone as plan_tz
    into v_w
  from public.workouts w
  join public.plans p on p.id = w.plan_id
  where w.id = p_id
    and p.is_active
    and (p.auth_user_id = v_uid or p.profile_id = v_uid)
  for update of w;
  if not found then
    if public.athlete_request_seen(v_uid, p_request_id) then
      return 'duplicate';
    end if;
    raise exception 'workout_not_found' using errcode = 'P0002';
  end if;

  -- Two requests with the same id: the second waits here, then sees the event.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_request_id::text, 63));
  if public.athlete_request_seen(v_uid, p_request_id) then
    return 'duplicate';
  end if;

  if not v_w.locked then
    raise exception 'workout_not_locked' using errcode = 'P0001';
  end if;
  if not public.link_is_v2(v_coach, v_uid) then
    raise exception 'v2_unavailable' using errcode = 'P0001';
  end if;

  v_today := public.coach_athlete_today(v_uid, v_w.plan_tz);
  if v_w.completed or v_w.scheduled_date < v_today then
    raise exception 'workout_not_editable' using errcode = 'P0001';
  end if;

  if p_action = 'move' then
    if p_new_date is null or p_new_date < v_today then
      raise exception 'workout_not_editable' using errcode = 'P0001';
    end if;
    if p_new_date > v_today + 366 or p_new_date = v_w.scheduled_date then
      raise exception 'invalid_workout' using errcode = '22023', detail = 'date';
    end if;
    -- Same plan-day lock key as M6a's coach create / move.
    perform pg_advisory_xact_lock(hashtextextended(v_w.plan_id::text || p_new_date::text, 61));
    if exists (
      select 1 from public.workouts w
      where w.plan_id = v_w.plan_id and w.scheduled_date = p_new_date and w.id <> p_id
    ) then
      raise exception 'date_taken' using errcode = 'P0001';
    end if;
  end if;

  v_prev := coalesce(current_setting('runsmart.athlete_change', true), '');
  perform set_config('runsmart.athlete_change', 'on', true);
  if p_action = 'skip' then
    update public.workouts w
    set athlete_change = 'skipped',
        athlete_changed_at = now()
    where w.id = p_id;
  else
    update public.workouts w
    set original_date = coalesce(w.original_date, w.scheduled_date),
        scheduled_date = p_new_date,
        day = to_char(p_new_date, 'Dy'),
        week = greatest(1, ((p_new_date - v_w.plan_start) / 7) + 1),
        athlete_change = 'moved',
        athlete_changed_at = now()
    where w.id = p_id;
  end if;
  perform set_config('runsmart.athlete_change', v_prev, true);

  insert into public.coach_athlete_events (coach_id, athlete_id, kind, ref_id, client_id)
  values (v_coach, v_uid, case p_action when 'skip' then 'athlete_skip' else 'athlete_move' end,
          p_id, p_request_id);

  return 'changed';
end;
$$;

-- end_coach_link (M5b behavior + lock release) ---------------------------------------------

-- Ends one active link. Returns true when this call ended it, false when it was
-- already revoked or does not exist. Callers do their own authorization first:
-- this function trusts p_link_id. Not granted to any client role.
-- Everything below up to the lock release is M5b's body, unchanged.
create or replace function public.end_coach_link(p_link_id uuid, p_ended_by text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coach uuid;
  v_athlete uuid;
begin
  if p_link_id is null then
    raise exception 'missing link' using errcode = '22023';
  end if;
  if p_ended_by is null or p_ended_by not in ('athlete', 'coach') then
    raise exception 'invalid ended_by' using errcode = '22023';
  end if;

  update public.coach_athlete_links
  set status = 'revoked',
      revoked_at = now(),
      ended_by = p_ended_by
  where id = p_link_id
    and status = 'active'
  returning coach_id, athlete_id into v_coach, v_athlete;

  if not found then
    return false;
  end if;

  insert into public.coach_athlete_events (coach_id, athlete_id, kind)
  values (v_coach, v_athlete, case p_ended_by when 'athlete' then 'left' else 'removed' end);

  -- M6b (C8.1b): unlock this athlete's future workouts and clear coach_published,
  -- in the same transaction, after the link UPDATE above (lock 1, then the
  -- release takes 2 plans and 3 workouts). The workouts stay (G17). This also covers rows whose
  -- coach_id became null when a coach account was deleted (M6a).
  perform public.coach_release_athlete_locks(v_athlete);

  -- Later create or replace files add here: M7 (C8.6) deletes this athlete's
  -- drafts for v_coach.

  return true;
end;
$$;

-- leave_coach and coach_remove_athlete (M5b behavior + lock 0 first) -----------------------

-- Same signatures, return shapes, errors and bodies as M5b (20261121160000; the
-- live production bodies match it, read 2026-11-27). The only change: each takes
-- FOR KEY SHARE on the athlete's and the coach's auth.users rows before it locks
-- the link (M6a lock order 0 then 1). leave_coach keeps its 1.2.6 signature.
create or replace function public.leave_coach(expected_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_link uuid;
  v_coach uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- M6b (C8.1b): lock 0 before lock 1. end_coach_link's event insert checks
  -- foreign keys to both auth.users rows; taking them first means a concurrent
  -- coach account delete (which holds the coach's row and cascades into the
  -- link) waits for this call, or this call waits and then finds no link.
  select l.coach_id
    into v_coach
  from public.coach_athlete_links l
  where l.athlete_id = v_uid
    and l.id = expected_link_id
    and l.status = 'active';
  perform 1 from auth.users u where u.id in (v_uid, v_coach) for key share of u;

  select l.id
    into v_link
  from public.coach_athlete_links l
  where l.athlete_id = v_uid
    and l.id = expected_link_id
    and l.status = 'active'
  for update;

  -- Two steps on purpose: SQL does not promise to short-circuit "or", and
  -- end_coach_link(null, ..) would raise a different error.
  if not found then
    raise exception 'not_linked' using errcode = 'P0001';
  end if;
  if not public.end_coach_link(v_link, 'athlete') then
    raise exception 'not_linked' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.coach_remove_athlete(p_athlete uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_link uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_athlete is null then
    raise exception 'missing athlete' using errcode = '22023';
  end if;

  -- M6b (C8.1b): lock 0 (both auth.users rows, KEY SHARE) before lock 1 (the
  -- link), as in leave_coach above.
  perform 1 from auth.users u where u.id in (v_uid, p_athlete) for key share of u;

  if public.is_active_coach_of(p_athlete) then
    select l.id
      into v_link
    from public.coach_athlete_links l
    where l.coach_id = v_uid
      and l.athlete_id = p_athlete
      and l.status = 'active'
    for update;

    if found then
      if public.end_coach_link(v_link, 'coach') then
        return 'removed';
      end if;
    end if;
  end if;

  -- Idempotent repeat: this coach's newest link with the athlete has ended.
  if exists (
    select 1
    from public.coach_athlete_links l
    where l.coach_id = v_uid
      and l.athlete_id = p_athlete
      and l.status = 'revoked'
      and l.created_at = (
        select max(l2.created_at)
        from public.coach_athlete_links l2
        where l2.coach_id = v_uid
          and l2.athlete_id = p_athlete
      )
  ) then
    return 'already_ended';
  end if;

  raise exception 'not_linked' using errcode = 'P0001';
end;
$$;

-- Lock release when a link row is deleted -------------------------------------------------

-- purge_coach_data_for_deleted_account (called by delete_account) deletes the
-- links of a deleted user directly, and deleting a coach's auth user cascades
-- through coach_profiles to the links. Neither runs end_coach_link. When an
-- active link row goes and its athlete still exists, release the athlete's locks.
-- That covers a coach account being deleted. For an athlete deleting their own
-- account, delete_account calls the purge while their auth row still exists, so
-- the release runs too: it unlocks whatever rows are left (delete_account has
-- usually wiped them already), and the auth delete then cascades through them.
-- When the auth delete itself cascades to the link, the athlete row is already
-- gone and nothing is touched.
create or replace function public.coach_links_release_locks_on_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'active'
     and exists (select 1 from auth.users u where u.id = old.athlete_id) then
    perform public.coach_release_athlete_locks(old.athlete_id);
  end if;
  return old;
end;
$$;

drop trigger if exists coach_links_release_locks_on_delete on public.coach_athlete_links;
create trigger coach_links_release_locks_on_delete
  after delete on public.coach_athlete_links
  for each row execute function public.coach_links_release_locks_on_delete();

-- replace_group_training_plan (Story 1.8 behavior + clear error) ----------------------------

-- Same signature, security invoker and body as 20261117163000, plus one check
-- after the lock: if the plan it would deactivate is coach-published or has locked
-- future workouts, it raises before touching anything, with a hint naming the way
-- out. (Without the check the plans trigger raises the same code mid-way.)
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

  -- M6b (C8.1b): a clear error when a coach lock blocks the replacement.
  if exists (
    select 1 from public.plans p
    where p.is_active and p.coach_published
      and (p.auth_user_id = athlete or (p.auth_user_id is null and p.profile_id = plan_row.profile_id))
  ) then
    raise exception 'plan_locked_by_coach' using errcode = 'P0001',
      detail = 'replace_group_training_plan: the active plan is published by the coach.',
      hint = 'Ask the coach to change the plan.';
  end if;
  if exists (
    select 1 from public.plans p
    where p.is_active
      and (p.auth_user_id = athlete or (p.auth_user_id is null and p.profile_id = plan_row.profile_id))
      and public.coach_plan_locked_future_count(p.id) > 0
  ) then
    raise exception 'coach_workouts_present' using errcode = 'P0001',
      detail = 'replace_group_training_plan: the active plan has coach-set future workouts.',
      hint = 'Use athlete_replace_training_plan with the acknowledged count.';
  end if;

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

-- Function grants -----------------------------------------------------------------

revoke all on function public.athlete_replace_training_plan(uuid, jsonb, jsonb, integer) from public, anon;
grant execute on function public.athlete_replace_training_plan(uuid, jsonb, jsonb, integer) to authenticated;

revoke all on function public.athlete_change_coach_workout(uuid, text, date, uuid) from public, anon;
grant execute on function public.athlete_change_coach_workout(uuid, text, date, uuid) to authenticated;

revoke all on function public.replace_group_training_plan(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.replace_group_training_plan(uuid, jsonb, jsonb) to authenticated;

revoke all on function public.leave_coach(uuid) from public, anon;
grant execute on function public.leave_coach(uuid) to authenticated;

revoke all on function public.coach_remove_athlete(uuid) from public, anon;
grant execute on function public.coach_remove_athlete(uuid) to authenticated;

-- The plans trigger runs as the client and calls this one, so authenticated keeps
-- it (it answers only for the caller's own plans). The service role keeps it for
-- its own plan writes.
revoke all on function public.coach_plan_locked_future_count(uuid) from public, anon;
grant execute on function public.coach_plan_locked_future_count(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.coach_plan_locked_future_count(uuid) to service_role;
  end if;
end $$;

-- Internal only. Security-definer callers (owned by the migration role) keep them.
revoke all on function public.end_coach_link(uuid, text) from public, anon, authenticated;
revoke all on function public.coach_release_athlete_locks(uuid) from public, anon, authenticated;
revoke all on function public.athlete_request_seen(uuid, uuid) from public, anon, authenticated;
revoke all on function public.plans_protect_coach_plans() from public, anon, authenticated;
revoke all on function public.coach_links_release_locks_on_delete() from public, anon, authenticated;

-- Report. No per-row updates happen above. ---------------------------------------------

do $$
declare
  v_plans bigint;
  v_published bigint;
  v_active_with_locks bigint;
begin
  select count(*), count(*) filter (where coach_published)
    into v_plans, v_published
  from public.plans;
  select count(distinct w.plan_id) into v_active_with_locks
  from public.workouts w
  join public.plans p on p.id = w.plan_id
  where p.is_active and w.locked;
  raise notice 'coach_plan_locks: plans % rows, % coach_published; % active plans with locked workouts',
    v_plans, v_published, v_active_with_locks;
end $$;

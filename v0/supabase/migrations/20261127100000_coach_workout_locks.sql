-- Coach Experience v2, story C8.1a: coach-authored workout columns, coach write
-- RPCs and the workouts lock trigger. M6a, Batch C.
--
-- File name: reserved as 20261201100000 in the ledger. Renamed (unapplied) to
-- 20261127100000 because scripts/check_migrations.py rejects a timestamp more
-- than 24h in the future. It still sorts after every applied file.
--
-- Do not apply this to production from the app PR. Nadav applies Batch C
-- (this file and M6b, 20261201110000_coach_plan_locks.sql) together, at a quiet
-- time, after a read-only audit, with the rollback file ready. Mirror it to the
-- web repo Running-coach- at v0/supabase/migrations/. Do not apply an older copy.
--
-- "Coach" here means a HUMAN coach (Coach Mode). It is unrelated to the AI coach
-- (coach_message, coaching_style).
--
-- Depends on: Story 1.3 (coach_athlete_links, is_active_coach_of), C7.0 / M0
-- (link_is_v2, runtime_flags), C7.10 / M2a (notification_prefs.time_zone,
-- notification_time_zone_ok). plans and workouts are created by the web repo.
--
-- What this file creates:
--   workouts columns          source, locked, coach_id, coach_revision,
--                             published_version_id, coach_edited, athlete_change,
--                             athlete_changed_at, original_date. Constant
--                             defaults only, so existing rows read source='ai',
--                             locked=false with no per-row update.
--   athlete_plan_update_queue one row per athlete: the coach changes not yet
--                             pushed (D3). Every coach write RPC upserts it. The
--                             digest sender (C8.16) reads and clears it. No client
--                             access at all.
--   coach_create_workout      a new coach workout on a free day of the athlete's
--                             active plan.
--   coach_update_workout      replace the planned fields of a future workout
--                             (an AI workout becomes a coach one, coach_edited).
--   coach_move_workout        move a future workout to a free future day.
--   coach_delete_workout      the day becomes a locked coach 'rest' row, so the
--                             AI cannot refill it (spec B.6) [ASSUMPTION].
--   workouts_protect_coach_rows   BEFORE INSERT/UPDATE/DELETE trigger: every
--                             writer that is not a coach RPC keeps the coach's
--                             planned fields, cannot set lock columns and cannot
--                             delete a locked row.
--
-- How a write counts as a coach write: the RPC sets runsmart.coach_write = 'on'
-- for its transaction (set_config(..., true)). The trigger accepts that setting
-- only when current_user is not a client role (authenticated / anon), that is,
-- only inside a security definer function owned by the migration role, or for
-- Nadav's owner-only SQL. A client cannot run set_config through PostgREST, and
-- even if one found a way, its own role would make the trigger ignore it.
-- runsmart.athlete_change works the same way and is reserved for M6b's
-- athlete_change_coach_workout. M6a sets it nowhere.
--
-- Errors (raise ... using errcode). The client maps the message:
--   not authenticated         42501
--   not_coach                 42501  caller has no link to that athlete
--   workout_not_found         P0002  no such workout on the athlete's active plan,
--                                    or the caller is not linked to its owner
--   no_active_plan            P0002  the athlete has no active plan to add to
--   link_inactive             P0001  the link exists but is not active
--   v2_unavailable            P0001  link_is_v2 is false (kill switch, old build,
--                                    allowlist)
--   workout_not_editable      P0001  completed, or dated before the athlete's today
--   date_taken                P0001  the target day already has a workout
--   edit_conflict             40001  p_revision is not the row's coach_revision
--   invalid_structure         22023  workout_structure not an object of at most
--                                    16 KB with a "steps" array of objects
--   invalid_workout           22023  bad type, intensity, date or number range
--   bad_workout_id            22023  p_id missing, or it names another user's row
--
-- Seams for M6b (C8.1b, same batch): the plans columns (coach_published,
-- coach_id) and plans_protect_coach_plans, athlete_change_coach_workout, the
-- lock release in end_coach_link and the new replace_group_training_plan all go
-- in M6b. Until M6b is applied, an athlete can still delete or deactivate a
-- whole plan (deleting a plan cascades to its workouts, and the trigger lets FK
-- cascades through so account deletion keeps working). Apply both files together.
--
-- Idempotent: columns, table and index are "if not exists", functions are
-- create or replace, the trigger is dropped and recreated, grants are restated.
--
-- Rollback: supabase/rollback/20261127100000_coach_workout_locks.sql (drops the
-- trigger and the RPCs, keeps the columns, the queue table and their rows).
-- Unlock every row: supabase/rollback/release_all_coach_locks.sql (Nadav only).
-- Runbook: docs/coach-v2-rollback.md. Writer list: docs/coach-v2-writers.md.

-- workouts columns ---------------------------------------------------------------

alter table public.workouts
  add column if not exists source text not null default 'ai'
    constraint workouts_source_check check (source in ('ai', 'coach')),
  add column if not exists locked boolean not null default false,
  add column if not exists coach_id uuid references auth.users(id) on delete set null,
  add column if not exists coach_revision integer not null default 0
    constraint workouts_coach_revision_check check (coach_revision >= 0),
  -- M7 (coach_plan_versions) adds the foreign key when that table exists.
  add column if not exists published_version_id uuid,
  add column if not exists coach_edited boolean not null default false,
  add column if not exists athlete_change text
    constraint workouts_athlete_change_check check (athlete_change in ('skipped', 'moved')),
  add column if not exists athlete_changed_at timestamptz,
  add column if not exists original_date date;

-- M6b counts locked future rows per plan; coach RPCs look up a plan's day.
create index if not exists idx_workouts_locked_plan_date
  on public.workouts (plan_id, scheduled_date)
  where locked;

-- athlete_plan_update_queue ------------------------------------------------------

create table if not exists public.athlete_plan_update_queue (
  athlete_id uuid primary key references auth.users(id) on delete cascade,
  coach_id uuid references auth.users(id) on delete set null,
  first_change_at timestamptz not null default now(),
  last_change_at timestamptz not null default now(),
  change_count integer not null default 0 check (change_count >= 0),
  changes jsonb not null default '[]'::jsonb check (jsonb_typeof(changes) = 'array'),
  sent_at timestamptz
);

-- The digest (C8.16) looks for rows that are unsent and quiet for 10 minutes.
create index if not exists idx_athlete_plan_update_queue_pending
  on public.athlete_plan_update_queue (last_change_at)
  where sent_at is null;

alter table public.athlete_plan_update_queue enable row level security;
revoke all on table public.athlete_plan_update_queue from public, anon, authenticated;
-- No client policy and no client grant. Only security definer functions and the
-- service role (the digest sender) touch it.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, update, delete on table public.athlete_plan_update_queue to service_role;
  end if;
end $$;

-- Internal helpers ----------------------------------------------------------------

-- The athlete's "today": their notification time zone (M2a), else the plan's
-- created_in_timezone, else UTC. A bad zone name falls through to the next one.
create or replace function public.coach_athlete_today(p_athlete uuid, p_plan_tz text default null)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  select np.time_zone into v_tz
  from public.notification_prefs np
  where np.user_id = p_athlete;

  if v_tz is null or not public.notification_time_zone_ok(v_tz) then
    v_tz := p_plan_tz;
  end if;
  if v_tz is null or not public.notification_time_zone_ok(v_tz) then
    v_tz := 'UTC';
  end if;

  return (now() at time zone v_tz)::date;
end;
$$;

-- Every coach write RPC runs this first. Raises in the documented order:
-- no link at all -> p_missing_error, link not active -> link_inactive,
-- link_is_v2 false (kill switch included) -> v2_unavailable.
create or replace function public.coach_workout_gate(p_athlete uuid, p_missing_error text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_athlete is null or not exists (
    select 1 from public.coach_athlete_links l
    where l.coach_id = v_uid and l.athlete_id = p_athlete
  ) then
    if p_missing_error = 'not_coach' then
      raise exception 'not_coach' using errcode = '42501';
    end if;
    raise exception 'workout_not_found' using errcode = 'P0002';
  end if;
  if not public.is_active_coach_of(p_athlete) then
    raise exception 'link_inactive' using errcode = 'P0001';
  end if;
  if not public.link_is_v2(v_uid, p_athlete) then
    raise exception 'v2_unavailable' using errcode = 'P0001';
  end if;
end;
$$;

-- AC4: a JSON object of at most 16 KB whose "steps" is an array of objects.
-- Other top-level keys are allowed (C8.3 may add version / effort). Step-level
-- validation is on the client (C8.3) [ASSUMPTION]. Null means "no structure".
create or replace function public.coach_workout_structure_ok(p_structure jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_structure is null then
    return true;
  end if;
  -- Checked one step at a time: SQL does not promise AND short-circuits, and
  -- jsonb_array_length raises on a non-array.
  if jsonb_typeof(p_structure) is distinct from 'object'
     or octet_length(p_structure::text) > 16384
     or jsonb_typeof(p_structure -> 'steps') is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(p_structure -> 'steps') not between 1 and 100 then
    return false;
  end if;
  return not exists (
    select 1 from jsonb_array_elements(p_structure -> 'steps') s
    where jsonb_typeof(s) <> 'object'
  );
end;
$$;

-- Planned-field checks shared by create and update. Mirrors the live CHECKs on
-- workouts (type, intensity) so the client gets one clear error instead of 23514.
create or replace function public.coach_workout_fields_check(
  p_type text,
  p_distance numeric,
  p_duration integer,
  p_pace integer,
  p_notes text,
  p_structure jsonb,
  p_intensity text
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_type is null or p_type not in ('easy', 'tempo', 'intervals', 'long', 'time-trial',
                                      'hill', 'rest', 'race-pace', 'recovery', 'fartlek') then
    raise exception 'invalid_workout' using errcode = '22023', detail = 'type';
  end if;
  if p_intensity is not null
     and p_intensity not in ('easy', 'moderate', 'threshold', 'vo2max', 'anaerobic') then
    raise exception 'invalid_workout' using errcode = '22023', detail = 'intensity';
  end if;
  if p_distance is null or p_distance < 0 or p_distance > 200 then
    raise exception 'invalid_workout' using errcode = '22023', detail = 'distance';
  end if;
  if p_duration is not null and (p_duration < 0 or p_duration > 1440) then
    raise exception 'invalid_workout' using errcode = '22023', detail = 'duration';
  end if;
  if p_pace is not null and (p_pace < 0 or p_pace > 3600) then
    raise exception 'invalid_workout' using errcode = '22023', detail = 'pace';
  end if;
  if p_notes is not null and char_length(p_notes) > 2000 then
    raise exception 'invalid_workout' using errcode = '22023', detail = 'notes';
  end if;
  if not public.coach_workout_structure_ok(p_structure) then
    raise exception 'invalid_structure' using errcode = '22023';
  end if;
end;
$$;

-- D3: one queue row per athlete. A row that was already pushed (sent_at set)
-- starts a fresh window; otherwise the change is appended. changes keeps the
-- newest 50 entries; change_count keeps the true total.
create or replace function public.coach_queue_plan_update(
  p_athlete uuid,
  p_coach uuid,
  p_workout uuid,
  p_action text,
  p_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_change jsonb := jsonb_build_object(
    'workout_id', p_workout, 'action', p_action, 'date', p_date, 'at', now());
begin
  insert into public.athlete_plan_update_queue as q
    (athlete_id, coach_id, first_change_at, last_change_at, change_count, changes, sent_at)
  values
    (p_athlete, p_coach, now(), now(), 1, jsonb_build_array(v_change), null)
  on conflict (athlete_id) do update
    set coach_id = excluded.coach_id,
        first_change_at = case when q.sent_at is null then q.first_change_at else excluded.first_change_at end,
        last_change_at = excluded.last_change_at,
        change_count = case when q.sent_at is null then q.change_count + 1 else 1 end,
        changes = case
          when q.sent_at is not null then excluded.changes
          when jsonb_array_length(q.changes) >= 50 then (q.changes - 0) || excluded.changes
          else q.changes || excluded.changes
        end,
        sent_at = null;
end;
$$;

-- Loads a workout for a coach write: the row (locked FOR UPDATE), its athlete
-- and the plan's time zone. Only workouts on an active plan owned by that
-- athlete. Raises workout_not_found before revealing anything else.
create or replace function public.coach_workout_for_write(p_id uuid)
returns table (athlete_id uuid, plan_id uuid, plan_start date, plan_tz text,
               scheduled_date date, completed boolean, coach_revision integer, source text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
  select coalesce(w.auth_user_id, p.auth_user_id, p.profile_id),
         w.plan_id, p.start_date, p.created_in_timezone,
         w.scheduled_date, w.completed, w.coach_revision, w.source
  from public.workouts w
  join public.plans p on p.id = w.plan_id
  where w.id = p_id
    and p.is_active
    and coalesce(w.auth_user_id, p.auth_user_id, p.profile_id)
        = coalesce(p.auth_user_id, p.profile_id)
  for update of w;
end;
$$;

-- Coach write RPCs -----------------------------------------------------------------

-- New coach workout on p_date of the athlete's active plan. p_id is the client's
-- id, so an outbox retry of the same create returns the same revision instead of
-- failing with date_taken. Returns the row's coach_revision (1).
create or replace function public.coach_create_workout(
  p_athlete uuid,
  p_id uuid,
  p_date date,
  p_type text,
  p_distance numeric,
  p_duration integer default null,
  p_pace integer default null,
  p_notes text default null,
  p_workout_structure jsonb default null,
  p_intensity text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_plan uuid;
  v_start date;
  v_tz text;
  v_today date;
  v_existing record;
begin
  perform public.coach_workout_gate(p_athlete, 'not_coach');
  if p_id is null then
    raise exception 'bad_workout_id' using errcode = '22023';
  end if;

  -- Serialize calls with the same id, so a retry that overlaps the original
  -- request waits for it and then takes the retry path below (no raw 23505).
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 62));

  -- Outbox retry: the same id already written by this coach for this athlete.
  select w.coach_id, w.coach_revision, w.auth_user_id into v_existing
  from public.workouts w where w.id = p_id;
  if found then
    if v_existing.coach_id = v_uid and v_existing.auth_user_id = p_athlete then
      return v_existing.coach_revision;
    end if;
    raise exception 'bad_workout_id' using errcode = '22023';
  end if;

  perform public.coach_workout_fields_check(
    p_type, p_distance, p_duration, p_pace, p_notes, p_workout_structure, p_intensity);

  select p.id, p.start_date, p.created_in_timezone into v_plan, v_start, v_tz
  from public.plans p
  where p.is_active
    and (p.auth_user_id = p_athlete or (p.auth_user_id is null and p.profile_id = p_athlete))
  order by p.start_date desc
  limit 1;
  if not found then
    raise exception 'no_active_plan' using errcode = 'P0002';
  end if;

  v_today := public.coach_athlete_today(p_athlete, v_tz);
  if p_date is null or p_date < v_today then
    raise exception 'workout_not_editable' using errcode = 'P0001';
  end if;
  if p_date > v_today + 366 then
    raise exception 'invalid_workout' using errcode = '22023', detail = 'date';
  end if;

  -- One workout per day (spec B.6): serialize writers of this plan-day.
  perform pg_advisory_xact_lock(hashtextextended(v_plan::text || p_date::text, 61));
  if exists (select 1 from public.workouts w where w.plan_id = v_plan and w.scheduled_date = p_date) then
    raise exception 'date_taken' using errcode = 'P0001';
  end if;

  perform set_config('runsmart.coach_write', 'on', true);
  insert into public.workouts (
    id, plan_id, auth_user_id, week, day, type, distance, duration, pace, notes,
    workout_structure, intensity, completed, scheduled_date,
    source, locked, coach_id, coach_revision, coach_edited
  ) values (
    p_id, v_plan, p_athlete, greatest(1, ((p_date - v_start) / 7) + 1), to_char(p_date, 'Dy'),
    p_type, p_distance, p_duration, p_pace, nullif(btrim(coalesce(p_notes, '')), ''),
    p_workout_structure, p_intensity, false, p_date,
    'coach', true, v_uid, 1, false
  );
  perform set_config('runsmart.coach_write', 'off', true);

  perform public.coach_queue_plan_update(p_athlete, v_uid, p_id, 'create', p_date);
  return 1;
end;
$$;

-- Replaces every planned field of a future, not-completed workout. An AI workout
-- becomes a coach workout tagged coach_edited ("Edited by {Coach}"). Returns the
-- new coach_revision.
create or replace function public.coach_update_workout(
  p_id uuid,
  p_revision integer,
  p_type text,
  p_distance numeric,
  p_duration integer default null,
  p_pace integer default null,
  p_notes text default null,
  p_workout_structure jsonb default null,
  p_intensity text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_w record;
  v_revision integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into v_w from public.coach_workout_for_write(p_id);
  if not found then
    raise exception 'workout_not_found' using errcode = 'P0002';
  end if;
  perform public.coach_workout_gate(v_w.athlete_id, 'workout_not_found');

  if v_w.completed or v_w.scheduled_date < public.coach_athlete_today(v_w.athlete_id, v_w.plan_tz) then
    raise exception 'workout_not_editable' using errcode = 'P0001';
  end if;
  if p_revision is null or p_revision <> v_w.coach_revision then
    raise exception 'edit_conflict' using errcode = '40001';
  end if;
  perform public.coach_workout_fields_check(
    p_type, p_distance, p_duration, p_pace, p_notes, p_workout_structure, p_intensity);

  perform set_config('runsmart.coach_write', 'on', true);
  update public.workouts w
  set type = p_type,
      distance = p_distance,
      duration = p_duration,
      pace = p_pace,
      notes = nullif(btrim(coalesce(p_notes, '')), ''),
      workout_structure = p_workout_structure,
      intensity = p_intensity,
      coach_edited = w.coach_edited or w.source = 'ai',
      source = 'coach',
      locked = true,
      coach_id = v_uid,
      coach_revision = w.coach_revision + 1
  where w.id = p_id
  returning w.coach_revision into v_revision;
  perform set_config('runsmart.coach_write', 'off', true);

  perform public.coach_queue_plan_update(v_w.athlete_id, v_uid, p_id, 'update', v_w.scheduled_date);
  return v_revision;
end;
$$;

-- Moves a future, not-completed workout to a free future day of the same plan.
-- A missing or stale p_revision raises edit_conflict, as for update.
create or replace function public.coach_move_workout(
  p_id uuid,
  p_new_date date,
  p_revision integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_w record;
  v_today date;
  v_revision integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into v_w from public.coach_workout_for_write(p_id);
  if not found then
    raise exception 'workout_not_found' using errcode = 'P0002';
  end if;
  perform public.coach_workout_gate(v_w.athlete_id, 'workout_not_found');

  v_today := public.coach_athlete_today(v_w.athlete_id, v_w.plan_tz);
  if v_w.completed or v_w.scheduled_date < v_today then
    raise exception 'workout_not_editable' using errcode = 'P0001';
  end if;
  if p_revision is null or p_revision <> v_w.coach_revision then
    raise exception 'edit_conflict' using errcode = '40001';
  end if;
  if p_new_date is null or p_new_date < v_today then
    raise exception 'workout_not_editable' using errcode = 'P0001';
  end if;
  if p_new_date > v_today + 366 then
    raise exception 'invalid_workout' using errcode = '22023', detail = 'date';
  end if;

  if p_new_date <> v_w.scheduled_date then
    perform pg_advisory_xact_lock(hashtextextended(v_w.plan_id::text || p_new_date::text, 61));
    if exists (
      select 1 from public.workouts w
      where w.plan_id = v_w.plan_id and w.scheduled_date = p_new_date and w.id <> p_id
    ) then
      raise exception 'date_taken' using errcode = 'P0001';
    end if;
  end if;

  perform set_config('runsmart.coach_write', 'on', true);
  update public.workouts w
  set scheduled_date = p_new_date,
      day = to_char(p_new_date, 'Dy'),
      week = greatest(1, ((p_new_date - v_w.plan_start) / 7) + 1),
      coach_edited = w.coach_edited or w.source = 'ai',
      source = 'coach',
      locked = true,
      coach_id = v_uid,
      coach_revision = w.coach_revision + 1
  where w.id = p_id
  returning w.coach_revision into v_revision;
  perform set_config('runsmart.coach_write', 'off', true);

  perform public.coach_queue_plan_update(v_w.athlete_id, v_uid, p_id, 'move', p_new_date);
  return v_revision;
end;
$$;

-- AC3: the day becomes a locked coach rest row ("Rest (from {Coach})"), not an
-- empty day, so the AI cannot refill it [ASSUMPTION]. The row keeps its id.
create or replace function public.coach_delete_workout(
  p_id uuid,
  p_revision integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_w record;
  v_revision integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into v_w from public.coach_workout_for_write(p_id);
  if not found then
    raise exception 'workout_not_found' using errcode = 'P0002';
  end if;
  perform public.coach_workout_gate(v_w.athlete_id, 'workout_not_found');

  if v_w.completed or v_w.scheduled_date < public.coach_athlete_today(v_w.athlete_id, v_w.plan_tz) then
    raise exception 'workout_not_editable' using errcode = 'P0001';
  end if;
  if p_revision is null or p_revision <> v_w.coach_revision then
    raise exception 'edit_conflict' using errcode = '40001';
  end if;

  perform set_config('runsmart.coach_write', 'on', true);
  update public.workouts w
  set type = 'rest',
      distance = 0,
      duration = null,
      pace = null,
      notes = null,
      workout_structure = null,
      intensity = null,
      coach_edited = false,
      source = 'coach',
      locked = true,
      coach_id = v_uid,
      coach_revision = w.coach_revision + 1
  where w.id = p_id
  returning w.coach_revision into v_revision;
  perform set_config('runsmart.coach_write', 'off', true);

  perform public.coach_queue_plan_update(v_w.athlete_id, v_uid, p_id, 'delete', v_w.scheduled_date);
  return v_revision;
end;
$$;

-- The lock trigger ------------------------------------------------------------------

-- Security invoker on purpose: it reads only OLD/NEW, two settings and the role.
create or replace function public.workouts_protect_coach_rows()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_trusted boolean := current_user not in ('authenticated', 'anon');
  v_coach_write boolean := v_trusted
    and coalesce(current_setting('runsmart.coach_write', true), '') = 'on';
  v_athlete_change boolean := v_trusted
    and coalesce(current_setting('runsmart.athlete_change', true), '') = 'on';
begin
  if v_coach_write then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A non-coach writer can never create a coach or locked row.
    new.source := 'ai';
    new.locked := false;
    new.coach_id := null;
    new.coach_revision := 0;
    new.published_version_id := null;
    new.coach_edited := false;
    new.athlete_change := null;
    new.athlete_changed_at := null;
    new.original_date := null;
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- FK cascades (a plan or an auth user being deleted) arrive one trigger level
    -- down and pass. So does the service role: delete_account wipes workouts
    -- directly and must never be blocked. Plan-level protection is M6b's.
    if old.locked and pg_trigger_depth() < 2 and current_user <> 'service_role' then
      raise exception 'workout_locked' using errcode = 'P0001';
    end if;
    return old;
  end if;

  -- UPDATE. Lock columns always come from OLD for a non-coach writer, with one
  -- exception: a referential action. workouts.coach_id is ON DELETE SET NULL, so
  -- deleting a coach's auth user runs an UPDATE here one trigger level down.
  -- Restoring the old coach_id would fail that delete on the foreign key, and the
  -- coach could never delete their account. So at depth > 1 a change of coach_id
  -- (or published_version_id, once M7 adds its FK) to null is kept. The row stays
  -- locked with coach_id null; M6b's lock release at link end unlocks it. A client
  -- statement always runs at depth 1, so it can never take this path.
  if not (pg_trigger_depth() > 1 and new.coach_id is null) then
    new.coach_id := old.coach_id;
  end if;
  if not (pg_trigger_depth() > 1 and new.published_version_id is null) then
    new.published_version_id := old.published_version_id;
  end if;
  new.source := old.source;
  new.locked := old.locked;
  new.coach_revision := old.coach_revision;
  new.coach_edited := old.coach_edited;

  if not old.locked then
    -- Solo users and unlocked rows: unchanged behavior, except the M6b
    -- athlete-change columns, which only that RPC writes.
    new.athlete_change := old.athlete_change;
    new.athlete_changed_at := old.athlete_changed_at;
    new.original_date := old.original_date;
    return new;
  end if;

  -- Locked row. Planned fields are kept for every non-coach writer. It does not
  -- raise, so 1.2.6 clients and the web sync never fail mid-batch.
  new.plan_id := old.plan_id;
  new.auth_user_id := old.auth_user_id;
  new.local_id := old.local_id;
  new.type := old.type;
  new.distance := old.distance;
  new.duration := old.duration;
  new.pace := old.pace;
  new.notes := old.notes;
  new.workout_structure := old.workout_structure;
  new.intensity := old.intensity;
  new.training_phase := old.training_phase;
  new.created_at := old.created_at;

  if v_athlete_change then
    -- M6b athlete skip / move: only the date (with its derived day and week) and
    -- the athlete-change columns change. Completion is kept as well.
    new.completed := old.completed;
    new.completed_at := old.completed_at;
    new.actual_distance_km := old.actual_distance_km;
    new.actual_duration_minutes := old.actual_duration_minutes;
    new.actual_pace := old.actual_pace;
    return new;
  end if;

  -- Everyone else: completion fields (completed, completed_at, actual_*) change;
  -- the date and the athlete-change columns are kept.
  new.scheduled_date := old.scheduled_date;
  new.day := old.day;
  new.week := old.week;
  new.athlete_change := old.athlete_change;
  new.athlete_changed_at := old.athlete_changed_at;
  new.original_date := old.original_date;
  return new;
end;
$$;

drop trigger if exists workouts_protect_coach_rows on public.workouts;
create trigger workouts_protect_coach_rows
  before insert or update or delete on public.workouts
  for each row execute function public.workouts_protect_coach_rows();

-- Function grants -----------------------------------------------------------------

revoke all on function public.coach_create_workout(uuid, uuid, date, text, numeric, integer, integer, text, jsonb, text) from public, anon;
grant execute on function public.coach_create_workout(uuid, uuid, date, text, numeric, integer, integer, text, jsonb, text) to authenticated;

revoke all on function public.coach_update_workout(uuid, integer, text, numeric, integer, integer, text, jsonb, text) from public, anon;
grant execute on function public.coach_update_workout(uuid, integer, text, numeric, integer, integer, text, jsonb, text) to authenticated;

revoke all on function public.coach_move_workout(uuid, date, integer) from public, anon;
grant execute on function public.coach_move_workout(uuid, date, integer) to authenticated;

revoke all on function public.coach_delete_workout(uuid, integer) from public, anon;
grant execute on function public.coach_delete_workout(uuid, integer) to authenticated;

-- Internal only. Security-definer callers (owned by the migration role) keep them.
revoke all on function public.coach_athlete_today(uuid, text) from public, anon, authenticated;
revoke all on function public.coach_workout_gate(uuid, text) from public, anon, authenticated;
revoke all on function public.coach_workout_structure_ok(jsonb) from public, anon, authenticated;
revoke all on function public.coach_workout_fields_check(text, numeric, integer, integer, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.coach_queue_plan_update(uuid, uuid, uuid, text, date) from public, anon, authenticated;
revoke all on function public.coach_workout_for_write(uuid) from public, anon, authenticated;
revoke all on function public.workouts_protect_coach_rows() from public, anon, authenticated;

-- Report (AC1). No per-row updates happen above. ------------------------------------

do $$
declare
  v_total bigint;
  v_locked bigint;
  v_coach bigint;
  v_queue bigint;
begin
  select count(*), count(*) filter (where locked), count(*) filter (where source = 'coach')
    into v_total, v_locked, v_coach
  from public.workouts;
  select count(*) into v_queue from public.athlete_plan_update_queue;
  raise notice 'coach_workout_locks: workouts % rows, % locked, % source=coach; athlete_plan_update_queue % rows',
    v_total, v_locked, v_coach, v_queue;
end $$;

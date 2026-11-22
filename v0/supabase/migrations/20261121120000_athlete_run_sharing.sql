-- Coach Experience v2, story C7.3: the athlete's effort (RPE) and run note are
-- synced to the server and shared with the coach. M1a, Batch A.
--
-- Do not apply this to production from the app PR. Nadav applies
-- 20261121120000_athlete_run_sharing.sql himself, in Batch A, after
-- 20261121110000_coach_consent_v2.sql, the Grok Bot audit and the 1.2.6 regression.
-- Mirror it to the web repo Running-coach- at v0/supabase/migrations/. Do not
-- apply an older copy.
--
-- "Coach" here means a HUMAN coach (Coach Mode). It is unrelated to the AI coach
-- (coach_message, coaching_style).
--
-- Privacy change: until now RPE and run notes stayed on the phone. runs.notes
-- holds a system source note and is NOT reused. The athlete's own note gets a new
-- column, runs.athlete_note.
--
-- Depends on the web schema (runs), Story 1.3 (coach_athlete_links), Story 1.5
-- (purge_coach_data_for_deleted_account), Story 2.2 (coach_get_athletes_runs),
-- C7.0 (link_is_v2) and C7.8 (consent columns, coach_v2_sharing_allowed).
--
-- What this file adds:
--   runs.rpe                     smallint 1..10, null = not rated.
--   runs.athlete_note            text, at most 1000 characters (char_length).
--   runs.note_hidden_from_coach  per-run "Hide note from {Coach}".
--   athlete_set_run_rpe(...)            athlete write, own run only.
--   athlete_set_run_note(...)           athlete write, own run only.
--   athlete_set_run_note_hidden(...)    athlete write, own run only. Always allowed:
--                                       hiding is a privacy action.
--   coach_get_athletes_runs(...)        Story 2.2's read plus rpe and has_note.
--   coach_get_run_notes(p_run_ids)      the note text, skipping hidden notes.
--   purge_coach_data_for_deleted_account  also clears the new columns.
--
-- Every coach read of RPE or a note goes through a security-definer RPC that
-- checks coach_v2_sharing_allowed (link_is_v2 AND consent v2 acked). No policy on
-- runs changes: the coach still has no direct access to the table.
--
-- Decision D7 (the server enforces it, not only the app):
--   * Nothing is shared before the athlete accepts the v2 copy.
--   * A note on a run completed before the ack is never shared, even if edited later.
--   * RPE is shared for runs completed at most 14 days before the ack (the one-time
--     backfill) and for every later run.
-- The read side applies the same windows, so a value written another way (a direct
-- owner PATCH) still never reaches the coach outside them.
--
-- Errors the app's outbox reads (C7.3 AC1, v1.3 section 1.1):
--   v2_unavailable       the pair is not v2 now (kill switch, a client not on v2,
--                        unlisted App Store coach). Keep the change queued.
--   link_inactive        no active link. Drop the change.
--   consent_required     the athlete has not accepted the v2 copy. Drop it.
--   note_before_consent  the run was completed before the ack. Drop it.
--   rpe_before_window    the run was completed more than 14 days before the ack. Drop it.
--   bad_rpe / note_too_long  invalid input (errcode 22023). Drop it.
-- Writes return 'saved', or 'missing' when the run has no server row yet.
--
-- 1.2.6 clients upsert runs without these keys. PostgREST's upsert only sets the
-- columns it receives, so the stored values are kept (SQL test).
--
-- Idempotent: columns are add-if-not-exists, constraints are added only when
-- missing, functions are create or replace (coach_get_athletes_runs is dropped and
-- recreated because its result gains two columns), grants are restated.
--
-- Rollback: supabase/rollback/20261121120000_athlete_run_sharing.sql (drops the new
-- functions, restores Story 2.2's coach_get_athletes_runs and Story 1.5's purge,
-- keeps the columns and their values). Runbook: docs/coach-v2-rollback.md.

-- Columns ----------------------------------------------------------------------

alter table public.runs add column if not exists rpe smallint;
alter table public.runs add column if not exists athlete_note text;
alter table public.runs add column if not exists note_hidden_from_coach boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'runs_rpe_range'
      and conrelid = 'public.runs'::regclass
  ) then
    alter table public.runs
      add constraint runs_rpe_range check (rpe is null or rpe between 1 and 10);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'runs_athlete_note_length'
      and conrelid = 'public.runs'::regclass
  ) then
    alter table public.runs
      add constraint runs_athlete_note_length
      check (athlete_note is null or char_length(athlete_note) <= 1000);
  end if;
end $$;

do $$
declare
  v_rpe bigint;
  v_notes bigint;
begin
  select count(*) filter (where rpe is not null),
         count(*) filter (where athlete_note is not null)
    into v_rpe, v_notes
  from public.runs;
  raise notice 'athlete_run_sharing: runs with rpe = %, with athlete_note = % (no backfill here)', v_rpe, v_notes;
end $$;

-- Internal helpers --------------------------------------------------------------

-- The caller's own run by the key the app upserts it with (DBRunInsert:
-- source_provider + source_activity_id). runsmart_ios ids are uuid strings, so
-- both letter cases are matched. Null when the run has no server row yet.
create or replace function public.athlete_own_run_id(p_source_provider text, p_source_activity_id text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select r.id
  from public.runs r
  where auth.uid() is not null
    and r.auth_user_id = auth.uid()
    and r.source_provider = p_source_provider
    and r.source_activity_id in (p_source_activity_id, lower(p_source_activity_id), upper(p_source_activity_id))
  order by r.id
  limit 1;
$$;

-- The checks every sharing write makes for the signed-in athlete. Returns the
-- active link's ack time. Raises the outbox errors listed at the top.
create or replace function public.athlete_sharing_ack_time()
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_coach uuid;
  v_version integer;
  v_ack timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select l.coach_id, l.consent_version, l.consent_acknowledged_at
    into v_coach, v_version, v_ack
  from public.coach_athlete_links l
  where l.athlete_id = v_uid
    and l.status = 'active';

  if not found then
    raise exception 'link_inactive' using errcode = 'P0001';
  end if;

  if not public.link_is_v2(v_coach, v_uid) then
    raise exception 'v2_unavailable' using errcode = 'P0001';
  end if;

  if v_version < 2 or v_ack is null then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;

  return v_ack;
end;
$$;

-- Athlete writes ------------------------------------------------------------------

-- P7 effort. p_rpe null clears it. Idempotent: the same call twice stores one value.
create or replace function public.athlete_set_run_rpe(
  p_source_provider text,
  p_source_activity_id text,
  p_rpe integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ack timestamptz;
  v_run bigint;
  v_completed timestamptz;
begin
  if p_rpe is not null and (p_rpe < 1 or p_rpe > 10) then
    raise exception 'bad_rpe' using errcode = '22023';
  end if;

  v_ack := public.athlete_sharing_ack_time();

  v_run := public.athlete_own_run_id(p_source_provider, p_source_activity_id);
  if v_run is null then
    return 'missing';
  end if;

  select r.completed_at into v_completed from public.runs r where r.id = v_run for update;

  if v_completed is null or v_completed < v_ack - interval '14 days' then
    raise exception 'rpe_before_window' using errcode = 'P0001';
  end if;

  update public.runs set rpe = p_rpe::smallint where id = v_run;
  return 'saved';
end;
$$;

-- P7 note. Blank or null clears it. The coach sees the latest version, no history
-- (C7.3 AC1). Notes on runs completed before the ack are never stored (D7).
create or replace function public.athlete_set_run_note(
  p_source_provider text,
  p_source_activity_id text,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ack timestamptz;
  v_run bigint;
  v_completed timestamptz;
  v_note text := nullif(btrim(p_note), '');
begin
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;

  v_ack := public.athlete_sharing_ack_time();

  v_run := public.athlete_own_run_id(p_source_provider, p_source_activity_id);
  if v_run is null then
    return 'missing';
  end if;

  select r.completed_at into v_completed from public.runs r where r.id = v_run for update;

  if v_completed is null or v_completed < v_ack then
    raise exception 'note_before_consent' using errcode = 'P0001';
  end if;

  update public.runs set athlete_note = v_note where id = v_run;
  return 'saved';
end;
$$;

-- "Hide note from {Coach}" (C7.3 AC5). Own run only. No link, v2 or consent check:
-- hiding must work with the kill switch on, so the note stays hidden when it returns.
create or replace function public.athlete_set_run_note_hidden(
  p_source_provider text,
  p_source_activity_id text,
  p_hidden boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run bigint;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_hidden is null then
    raise exception 'bad_hidden' using errcode = '22023';
  end if;

  v_run := public.athlete_own_run_id(p_source_provider, p_source_activity_id);
  if v_run is null then
    return 'missing';
  end if;

  update public.runs set note_hidden_from_coach = p_hidden where id = v_run;
  return 'saved';
end;
$$;

-- Coach reads ----------------------------------------------------------------------

-- Story 2.2's read, unchanged for the first ten columns, plus:
--   rpe       only while coach_v2_sharing_allowed, and only for runs completed at
--             most 14 days before the ack (D7). Otherwise null.
--   has_note  true only when coach_get_run_notes would return the note.
-- Rows themselves follow Story 2.2 (is_active_coach_of), so a 1.2.6 coach and a
-- coach with the kill switch on see exactly what they saw before.
drop function if exists public.coach_get_athletes_runs(date, date, uuid[]);

create function public.coach_get_athletes_runs(
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
  source text,
  rpe smallint,
  has_note boolean
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
    r.source_provider,
    case
      when s.allowed and r.completed_at >= l.consent_acknowledged_at - interval '14 days'
      then r.rpe
    end,
    coalesce(
      s.allowed
      and r.athlete_note is not null
      and not r.note_hidden_from_coach
      and r.completed_at >= l.consent_acknowledged_at,
      false
    )
  from public.coach_athlete_links l
  cross join lateral (
    select public.coach_v2_sharing_allowed(l.coach_id, l.athlete_id) as allowed
  ) s
  join public.runs r
    on r.auth_user_id = l.athlete_id
   and (r.completed_at at time zone 'utc')::date between p_from and p_to
  where l.status = 'active'
    and l.coach_id = auth.uid()
    and public.is_active_coach_of(l.athlete_id)
    and (p_athlete_ids is null or l.athlete_id = any (p_athlete_ids))
  order by r.completed_at, l.athlete_id, r.id;
$$;

-- The note text for the coach's day detail (C7.3 AC4, AC5, AC7). Ids that belong
-- to another coach's athlete, a revoked or removed link, a hidden note, a run
-- before the ack, or a pair that is not sharing are dropped silently.
create or replace function public.coach_get_run_notes(p_run_ids bigint[])
returns table (run_id bigint, athlete_note text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if coalesce(cardinality(p_run_ids), 0) > 500 then
    raise exception 'too_many_runs' using errcode = '22023';
  end if;

  return query
  select r.id, r.athlete_note
  from public.runs r
  join public.coach_athlete_links l
    on l.athlete_id = r.auth_user_id
   and l.coach_id = auth.uid()
   and l.status = 'active'
  where r.id = any (coalesce(p_run_ids, '{}'::bigint[]))
    and r.athlete_note is not null
    and not r.note_hidden_from_coach
    and r.completed_at >= l.consent_acknowledged_at
    and public.coach_v2_sharing_allowed(l.coach_id, l.athlete_id)
  order by r.id;
end;
$$;

-- Account deletion --------------------------------------------------------------------

-- Story 1.5's purge, unchanged, plus clearing the C7.3 columns on any run row that
-- is still present (delete_account deletes run rows first; this is the backstop).
-- A later migration that replaces this function must keep every block below.
create or replace function public.purge_coach_data_for_deleted_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'missing user' using errcode = '22023';
  end if;

  delete from public.coach_athlete_links
  where athlete_id = p_user_id
     or coach_id = p_user_id;

  -- Coach profile row. Invites cascade from coach_profiles.
  delete from public.coach_profiles
  where user_id = p_user_id;

  -- Later stories. Skip entirely until the table exists.
  if to_regclass('public.coach_feedback') is not null then
    delete from public.coach_feedback
    where athlete_id = p_user_id
       or coach_id = p_user_id;
  end if;

  if to_regclass('public.coach_plan_drafts') is not null then
    delete from public.coach_plan_drafts
    where athlete_id = p_user_id
       or coach_id = p_user_id;
  end if;

  -- delete_account deletes run rows, so an uploaded route stored on runs.route
  -- goes away with the row. If any run row for this user is still present,
  -- drop that column. Guarded so this works before the column exists.
  if to_regclass('public.runs') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'runs'
         and column_name = 'route'
     )
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'runs'
         and column_name = 'auth_user_id'
     ) then
    execute 'update public.runs set route = null where auth_user_id = $1'
      using p_user_id;
  end if;

  -- C7.3: effort and the athlete's note on any run row that is still present.
  if to_regclass('public.runs') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'runs'
         and column_name = 'athlete_note'
     ) then
    execute 'update public.runs set rpe = null, athlete_note = null, note_hidden_from_coach = false '
            'where auth_user_id = $1'
      using p_user_id;
  end if;
end;
$$;

-- Function grants ----------------------------------------------------------------------

revoke all on function public.athlete_set_run_rpe(text, text, integer) from public, anon;
grant execute on function public.athlete_set_run_rpe(text, text, integer) to authenticated;

revoke all on function public.athlete_set_run_note(text, text, text) from public, anon;
grant execute on function public.athlete_set_run_note(text, text, text) to authenticated;

revoke all on function public.athlete_set_run_note_hidden(text, text, boolean) from public, anon;
grant execute on function public.athlete_set_run_note_hidden(text, text, boolean) to authenticated;

revoke all on function public.coach_get_athletes_runs(date, date, uuid[]) from public, anon;
grant execute on function public.coach_get_athletes_runs(date, date, uuid[]) to authenticated;

revoke all on function public.coach_get_run_notes(bigint[]) from public, anon;
grant execute on function public.coach_get_run_notes(bigint[]) to authenticated;

-- Internal only. Security-definer callers (owned by the migration role) keep them.
revoke all on function public.athlete_own_run_id(text, text) from public, anon, authenticated;
revoke all on function public.athlete_sharing_ack_time() from public, anon, authenticated;
revoke all on function public.purge_coach_data_for_deleted_account(uuid) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.purge_coach_data_for_deleted_account(uuid) to service_role;
  end if;
end $$;

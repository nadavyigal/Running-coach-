-- Coach Experience v2, story C7.4: the athlete's "Pain / something off" flag,
-- shared with the coach. M1b, Batch A.
--
-- Do not apply this to production from the app PR. Nadav applies
-- 20261121150000_athlete_run_flags.sql himself, in Batch A, after
-- 20261121100000_coach_v2_gate.sql, 20261121110000_coach_consent_v2.sql,
-- 20261121120000_athlete_run_sharing.sql and
-- 20261121130000_coach_last_seen_and_events.sql, the Grok Bot audit and the 1.2.6
-- regression. Mirror it to the web repo Running-coach- at v0/supabase/migrations/.
-- Do not apply an older copy.
--
-- "Coach" here means a HUMAN coach (Coach Mode). It is unrelated to the AI coach
-- (coach_message, coaching_style).
--
-- A flag is athlete health data. It reaches the coach only through the
-- security-definer reads below, and only while coach_v2_sharing_allowed holds
-- (link_is_v2 AND consent v2 acked). No plan, AI or flex-week code reads this table.
--
-- Depends on the web schema (runs), Story 1.3 (coach_athlete_links), Story 1.5
-- (purge_coach_data_for_deleted_account), Story 2.2 (is_active_coach_of), C7.0
-- (link_is_v2), C7.8 (coach_v2_sharing_allowed), C7.3 (athlete_own_run_id,
-- athlete_sharing_ack_time, and its purge replacement) and C7.2
-- (coach_athlete_seen, coach_athlete_events, coach_roster_summary).
--
-- What this file adds:
--   athlete_run_flags            one row per flag. kind 'pain' or 'off', an optional
--                                note of at most 500 characters, the run it is about
--                                (null for a run-less flag), the link it was sent on.
--   athlete_flag_run(...)        athlete write, idempotent by the client id p_id.
--   athlete_remove_flag(p_id)    athlete delete, only before the flag is resolved.
--   coach_get_athlete_flags(...) coach read: open flags, and recently resolved ones.
--   coach_resolve_flag(p_flag_id)  coach write ("Mark handled"), idempotent.
--   coach_roster_summary()       C7.2's read, same signature, now fills new_flags.
--   purge_coach_data_for_deleted_account  also deletes the user's flags.
--
-- The flag belongs to the link it was sent on (link_id), not to the coach. After a
-- leave, a removal or a rejoin (join_coach inserts a new link row) the coach sees
-- none of the earlier flags. The athlete always sees their own flags (owner select).
--
-- Gates:
--   * athlete_flag_run uses C7.3's athlete_sharing_ack_time: link_inactive,
--     v2_unavailable (keep queued) and consent_required. So a flag can only exist
--     for a link that had accepted the v2 copy when it was sent.
--   * athlete_remove_flag has no link, v2 or consent check: removing is a privacy
--     action and works with the kill switch on, like "Hide note" in C7.3.
--   * coach_resolve_flag: flag_not_found (not this coach's flag, removed, or an
--     athlete calling it), link_inactive, v2_unavailable, consent_required.
--   * Reads return zero rows unless the caller is the active coach on the flag's
--     own link and coach_v2_sharing_allowed holds.
--
-- Errors the app's outbox reads (v1.3 section 1.1):
--   v2_unavailable                       keep the action queued.
--   link_inactive, consent_required, flag_not_found, flag_resolved, bad_kind,
--   note_too_long, bad_flag_id           drop it.
--
-- Run deletion: run_id is on delete set null and run_linked stays true, so the
-- flag stays (it is health signal) and the coach read reports run_deleted.
--
-- Account deletion: athlete_id is on delete cascade, and the purge deletes the
-- user's flags and clears resolved_by where the user was the coach. Link end:
-- rows stay, and every coach read needs the flag's link to be active. C7.11 adds
-- coach_get_athlete_flags to its parity test.
--
-- Idempotent: the table and indexes are create if not exists, the checks and the
-- policy are added only when missing, functions are create or replace, grants
-- are restated.
--
-- Rollback: supabase/rollback/20261121150000_athlete_run_flags.sql (drops the four
-- flag functions, restores C7.2's coach_roster_summary and C7.3's purge, keeps the
-- table and its rows). Runbook: docs/coach-v2-rollback.md.

-- Table ------------------------------------------------------------------------------

create table if not exists public.athlete_run_flags (
  -- Made on the phone and sent as p_id, so a retried flush stores one row.
  id uuid primary key,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  -- The link the flag was sent on. Null only after the link row was deleted.
  link_id uuid references public.coach_athlete_links(id) on delete set null,
  run_id bigint references public.runs(id) on delete set null,
  -- True when the flag was saved with a run. With run_id null it means the run was deleted.
  run_linked boolean not null default false,
  kind text not null,
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'athlete_run_flags_kind'
      and conrelid = 'public.athlete_run_flags'::regclass
  ) then
    alter table public.athlete_run_flags
      add constraint athlete_run_flags_kind check (kind in ('pain', 'off'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'athlete_run_flags_note_length'
      and conrelid = 'public.athlete_run_flags'::regclass
  ) then
    alter table public.athlete_run_flags
      add constraint athlete_run_flags_note_length
      check (note is null or char_length(note) <= 500);
  end if;
end $$;

create index if not exists athlete_run_flags_link_created
  on public.athlete_run_flags (link_id, created_at);

create index if not exists athlete_run_flags_athlete_created
  on public.athlete_run_flags (athlete_id, created_at desc);

-- Keeps a run delete from scanning this table.
create index if not exists athlete_run_flags_run
  on public.athlete_run_flags (run_id)
  where run_id is not null;

-- RLS and table grants ----------------------------------------------------------------

alter table public.athlete_run_flags enable row level security;

revoke all on table public.athlete_run_flags from public, anon, authenticated;
-- The athlete reads their own flags. No client write: every write is an RPC below.
grant select on table public.athlete_run_flags to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_run_flags'
      and policyname = 'athlete_run_flags_owner_select'
  ) then
    create policy athlete_run_flags_owner_select on public.athlete_run_flags
      for select to authenticated
      using (athlete_id = (select auth.uid()));
  end if;
end $$;

-- Athlete writes ------------------------------------------------------------------------

-- P7 "Send to {Coach}" and the run-less "Something off?" entry on Today.
-- p_source_provider / p_source_activity_id name the run the way the app upserts it
-- (C7.3). Both null means a run-less flag. A run with no server row is saved
-- run-less (UX spec C.6 P7 fallback).
-- Returns 'saved' (with its run) or 'saved_without_run'. A repeated p_id returns the
-- first answer and changes nothing.
create or replace function public.athlete_flag_run(
  p_id uuid,
  p_kind text,
  p_note text default null,
  p_source_provider text default null,
  p_source_activity_id text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_note text := nullif(btrim(p_note), '');
  v_link uuid;
  v_run bigint;
  v_existing public.athlete_run_flags%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'bad_flag_id' using errcode = '22023';
  end if;
  if p_kind is null or p_kind not in ('pain', 'off') then
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;

  -- A retried flush: the first write stands.
  select * into v_existing from public.athlete_run_flags f where f.id = p_id;
  if found then
    if v_existing.athlete_id <> v_uid then
      raise exception 'bad_flag_id' using errcode = '22023';
    end if;
    return case when v_existing.run_linked then 'saved' else 'saved_without_run' end;
  end if;

  -- link_inactive / v2_unavailable / consent_required, as for effort and notes.
  perform public.athlete_sharing_ack_time();

  select l.id into v_link
  from public.coach_athlete_links l
  where l.athlete_id = v_uid
    and l.status = 'active';

  if p_source_provider is not null and p_source_activity_id is not null then
    v_run := public.athlete_own_run_id(p_source_provider, p_source_activity_id);
  end if;

  insert into public.athlete_run_flags (id, athlete_id, link_id, run_id, run_linked, kind, note)
  values (p_id, v_uid, v_link, v_run, v_run is not null, p_kind, v_note)
  on conflict (id) do nothing;

  -- Lost a race with a concurrent flush of the same id: answer from the stored row.
  select * into v_existing from public.athlete_run_flags f where f.id = p_id;
  if v_existing.athlete_id <> v_uid then
    raise exception 'bad_flag_id' using errcode = '22023';
  end if;
  return case when v_existing.run_linked then 'saved' else 'saved_without_run' end;
end;
$$;

-- P7 "Remove flag" (C7.4 AC5). Own flag only, and only while unresolved. Returns
-- 'removed', or 'missing' when there is no such flag of the caller's (already
-- removed, or never sent). A resolved flag raises flag_resolved and stays.
create or replace function public.athlete_remove_flag(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_resolved timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select f.resolved_at into v_resolved
  from public.athlete_run_flags f
  where f.id = p_id
    and f.athlete_id = v_uid
  for update;

  if not found then
    return 'missing';
  end if;
  if v_resolved is not null then
    raise exception 'flag_resolved' using errcode = 'P0001';
  end if;

  delete from public.athlete_run_flags where id = p_id and athlete_id = v_uid;
  return 'removed';
end;
$$;

-- Coach reads ---------------------------------------------------------------------------

-- Flags for the caller's active athletes, on each athlete's current link only.
-- Open flags always; with p_include_resolved, also flags resolved in the last 30
-- days (T3 "Handled by you · {date}"). Oldest first, at most 500 rows.
-- note is the athlete's text, shown verbatim to the coach only.
create or replace function public.coach_get_athlete_flags(
  p_athlete_ids uuid[] default null,
  p_include_resolved boolean default false
)
returns table (
  id uuid,
  athlete_id uuid,
  run_id bigint,
  run_deleted boolean,
  kind text,
  note text,
  created_at timestamptz,
  resolved_at timestamptz,
  resolved_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    f.id,
    f.athlete_id,
    f.run_id,
    f.run_linked and f.run_id is null,
    f.kind,
    f.note,
    f.created_at,
    f.resolved_at,
    coalesce(f.resolved_by = auth.uid(), false)
  from public.coach_athlete_links l
  join public.athlete_run_flags f
    on f.link_id = l.id
   and f.athlete_id = l.athlete_id
  where auth.uid() is not null
    and l.coach_id = auth.uid()
    and l.status = 'active'
    and public.is_active_coach_of(l.athlete_id)
    and public.coach_v2_sharing_allowed(l.coach_id, l.athlete_id)
    and (p_athlete_ids is null or l.athlete_id = any (p_athlete_ids))
    and (
      f.resolved_at is null
      or (coalesce(p_include_resolved, false) and f.resolved_at > now() - interval '30 days')
    )
  order by f.created_at, f.id
  limit 500;
$$;

-- Coach writes --------------------------------------------------------------------------

-- "Mark handled" (C7.4 AC7). The app's outbox sends it 5 s after the tap, behind the
-- "Marked handled · Undo" toast, so there is no un-resolve RPC. Returns resolved_at;
-- a repeated call returns the first time and changes nothing.
create or replace function public.coach_resolve_flag(p_flag_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_athlete uuid;
  v_status text;
  v_resolved timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select f.athlete_id, l.status, f.resolved_at
    into v_athlete, v_status, v_resolved
  from public.athlete_run_flags f
  join public.coach_athlete_links l on l.id = f.link_id
  where f.id = p_flag_id
    and l.coach_id = v_uid
  for update of f;

  if not found then
    raise exception 'flag_not_found' using errcode = 'P0001';
  end if;
  if v_status <> 'active' then
    raise exception 'link_inactive' using errcode = 'P0001';
  end if;
  if not public.link_is_v2(v_uid, v_athlete) then
    raise exception 'v2_unavailable' using errcode = 'P0001';
  end if;
  if not public.coach_v2_sharing_allowed(v_uid, v_athlete) then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;

  if v_resolved is not null then
    return v_resolved;
  end if;

  update public.athlete_run_flags
     set resolved_at = now(), resolved_by = v_uid
   where id = p_flag_id
  returning resolved_at into v_resolved;
  return v_resolved;
end;
$$;

-- Coach Today counts ------------------------------------------------------------------------

-- C7.2's function with the same signature and every C7.2 rule kept (see the C7.2
-- file's header: v2 pairs only, 7-day baseline, no future runs, left/removed never
-- counted). New here: new_flags counts open flags on the athlete's current link
-- created after the baseline, only while coach_v2_sharing_allowed holds, and
-- oldest_new_at considers them. new_replies stays 0 until C7.7 (M4).
create or replace function public.coach_roster_summary()
returns table (
  athlete_id uuid,
  seen_at timestamptz,
  new_runs integer,
  new_flags integer,
  new_replies integer,
  new_events integer,
  latest_event_kind text,
  oldest_new_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with pairs as (
    select
      l.id as link_id,
      l.coach_id,
      l.athlete_id,
      s.seen_at,
      greatest(coalesce(s.seen_at, '-infinity'::timestamptz), now() - interval '7 days') as baseline
    from public.coach_athlete_links l
    left join public.coach_athlete_seen s
      on s.coach_id = l.coach_id
     and s.athlete_id = l.athlete_id
    where auth.uid() is not null
      and l.coach_id = auth.uid()
      and l.status = 'active'
      and public.is_active_coach_of(l.athlete_id)
      and public.link_is_v2(l.coach_id, l.athlete_id)
  ),
  run_counts as (
    select p.athlete_id, count(r.id)::integer as n, min(r.completed_at) as oldest
    from pairs p
    join public.runs r
      on r.auth_user_id = p.athlete_id
     and r.completed_at > p.baseline
     and r.completed_at <= now()
    group by p.athlete_id
  ),
  flag_counts as (
    select p.athlete_id, count(f.id)::integer as n, min(f.created_at) as oldest
    from pairs p
    join public.athlete_run_flags f
      on f.link_id = p.link_id
     and f.athlete_id = p.athlete_id
     and f.resolved_at is null
     and f.created_at > p.baseline
    where public.coach_v2_sharing_allowed(p.coach_id, p.athlete_id)
    group by p.athlete_id
  ),
  event_counts as (
    select
      p.athlete_id,
      count(e.id)::integer as n,
      min(e.created_at) as oldest,
      (array_agg(e.kind order by e.created_at desc, e.id desc))[1] as latest_kind
    from pairs p
    join public.coach_athlete_events e
      on e.coach_id = auth.uid()
     and e.athlete_id = p.athlete_id
     and e.created_at > p.baseline
     and e.kind in ('goal_change', 'athlete_skip', 'athlete_move')
    group by p.athlete_id
  )
  select
    p.athlete_id,
    p.seen_at,
    coalesce(rc.n, 0),
    coalesce(fc.n, 0),
    0,
    coalesce(ec.n, 0),
    ec.latest_kind,
    (select min(t) from (values (rc.oldest), (fc.oldest), (ec.oldest)) v(t))
  from pairs p
  left join run_counts rc on rc.athlete_id = p.athlete_id
  left join flag_counts fc on fc.athlete_id = p.athlete_id
  left join event_counts ec on ec.athlete_id = p.athlete_id
  order by p.athlete_id;
$$;

-- Account deletion ----------------------------------------------------------------------------

-- C7.3's purge (Story 1.5 plus the C7.3 block), unchanged, plus the C7.4 block.
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

  -- C7.4: flags first, while their links still exist. As the athlete the flags go;
  -- as the coach only the "handled by" reference goes (the flag is the athlete's).
  if to_regclass('public.athlete_run_flags') is not null then
    delete from public.athlete_run_flags
    where athlete_id = p_user_id;

    update public.athlete_run_flags
       set resolved_by = null
     where resolved_by = p_user_id;
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

-- Function grants -------------------------------------------------------------------------------

revoke all on function public.athlete_flag_run(uuid, text, text, text, text) from public, anon;
grant execute on function public.athlete_flag_run(uuid, text, text, text, text) to authenticated;

revoke all on function public.athlete_remove_flag(uuid) from public, anon;
grant execute on function public.athlete_remove_flag(uuid) to authenticated;

revoke all on function public.coach_get_athlete_flags(uuid[], boolean) from public, anon;
grant execute on function public.coach_get_athlete_flags(uuid[], boolean) to authenticated;

revoke all on function public.coach_resolve_flag(uuid) from public, anon;
grant execute on function public.coach_resolve_flag(uuid) to authenticated;

revoke all on function public.coach_roster_summary() from public, anon;
grant execute on function public.coach_roster_summary() to authenticated;

revoke all on function public.purge_coach_data_for_deleted_account(uuid) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.purge_coach_data_for_deleted_account(uuid) to service_role;
  end if;
end $$;

do $$
declare
  v_flags bigint;
begin
  select count(*) into v_flags from public.athlete_run_flags;
  raise notice 'athlete_run_flags: % rows (no backfill here)', v_flags;
end $$;

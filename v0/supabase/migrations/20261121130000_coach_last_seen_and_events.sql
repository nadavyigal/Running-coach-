-- Coach Experience v2, story C7.2: "New since last visit" markers and coach
-- events. M3, Batch A.
--
-- Do not apply this to production from the app PR. Nadav applies
-- 20261121130000_coach_last_seen_and_events.sql himself, in Batch A, after
-- 20261121100000_coach_v2_gate.sql, 20261121110000_coach_consent_v2.sql and
-- 20261121120000_athlete_run_sharing.sql, the Grok Bot audit and the 1.2.6
-- regression. Mirror it to the web repo Running-coach- at
-- v0/supabase/migrations/. Do not apply an older copy.
--
-- "Coach" here means a HUMAN coach (Coach Mode). It is unrelated to the AI coach
-- (coach_message, coaching_style).
--
-- Depends on Story 1.3 (coach_athlete_links), Story 2.2 (is_active_coach_of,
-- runs read by coach_get_athletes_runs) and C7.0 (link_is_v2). It does not need
-- M5a or M1a; it sorts after them only to keep the Batch A order.
--
-- What this file creates:
--   coach_athlete_seen          one row per (coach, athlete): when the coach last
--                               opened the athlete's detail. Server-side, so a
--                               second coach phone clears the marker too.
--   coach_athlete_events        athlete-side facts the coach should notice. The
--                               kind list is defined once, here:
--                               athlete_skip, athlete_move (written by M6b),
--                               goal_change (written below), left, removed
--                               (written by M5b at link end).
--   coach_mark_athlete_seen(p_athlete, p_seen_at)  coach write, idempotent.
--   athlete_log_goal_change(p_client_id)           athlete write, idempotent by
--                               the client id the outbox sends.
--   coach_get_athlete_events(p_athlete, p_since)   coach read, newest first.
--   coach_roster_summary()      per v2 athlete of the caller: seen_at and the
--                               "new" counts for Coach Today.
--
-- Gates:
--   * Writes check link_is_v2. A pair that is not v2 (kill switch on, a client
--     not on v2, an unlisted App Store coach) raises v2_unavailable, so the app's
--     outbox keeps the item and retries on the next foreground.
--   * A coach with no active link gets link_inactive from the seen write; the app
--     drops the item.
--   * athlete_log_goal_change with no active link returns false and writes
--     nothing, with no error (C7.2 AC4).
--   * Reads return zero rows unless the caller is the active coach and the pair
--     is v2.
--   * None of these carry run detail, notes, effort or flags, so they need
--     link_is_v2 only, not coach_v2_sharing_allowed. The coach already sees the
--     athlete's plan and runs through Story 2.2.
--
-- What counts as "new" (coach_roster_summary):
--   * Runs whose completed_at is after the baseline and not in the future.
--   * goal_change, athlete_skip and athlete_move events created after the
--     baseline. left and removed are never counted: those links are gone.
--   * new_flags and new_replies are always 0 here. C7.4 (M1b) and C7.7 (M4)
--     replace this function with the same signature and fill them.
--   * Baseline = the later of seen_at and now() - 7 days. A coach who never
--     opened an athlete sees the last 7 days as new, the same window as the
--     Today dots, and an old seen row never makes a count reach back further.
--     [ASSUMPTION: 7 days, matching the dots window.]
--   * Known limit: runs.completed_at is the run's start, so a run imported long
--     after it happened, with a start before seen_at, is not counted. Only
--     columns from the 2026-11-14 live check are used (no runs.created_at).
--
-- Account deletion: both tables reference auth.users with on delete cascade.
-- The delete_account Edge Function deletes the auth user as its last step, so
-- these rows go with it. purge_coach_data_for_deleted_account is not replaced
-- here: M1a (C7.3) replaces it in the same batch, and a second replacement in
-- this file would undo M1a's additions. Until the auth user is gone the rows
-- are unreachable anyway: the purge removes the links, and every read here
-- needs an active link.
--
-- Link end: rows stay. Every read needs an active link, so a revoked coach sees
-- nothing. M5b writes left/removed events here.
--
-- Idempotent: tables and indexes are create if not exists, the kind check is
-- added only when missing, functions are create or replace, grants are restated.
--
-- Rollback: supabase/rollback/20261121130000_coach_last_seen_and_events.sql
-- (drops the four functions, keeps both tables and their rows). Runbook:
-- docs/coach-v2-rollback.md.

-- Tables -------------------------------------------------------------------------

create table if not exists public.coach_athlete_seen (
  coach_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (coach_id, athlete_id)
);

create table if not exists public.coach_athlete_events (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  -- The workout an athlete_skip / athlete_move is about (M6b). Null otherwise.
  ref_id uuid,
  -- Sent by the athlete's outbox, so a retried flush stores one row.
  client_id uuid,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'coach_athlete_events_kind'
      and conrelid = 'public.coach_athlete_events'::regclass
  ) then
    alter table public.coach_athlete_events
      add constraint coach_athlete_events_kind
      check (kind in ('athlete_skip', 'athlete_move', 'goal_change', 'left', 'removed'));
  end if;
end $$;

create unique index if not exists coach_athlete_events_athlete_client_id
  on public.coach_athlete_events (athlete_id, client_id)
  where client_id is not null;

create index if not exists coach_athlete_events_pair_created
  on public.coach_athlete_events (coach_id, athlete_id, created_at desc);

-- RLS and table grants -------------------------------------------------------------

alter table public.coach_athlete_seen enable row level security;
alter table public.coach_athlete_events enable row level security;

-- No client policy and no client grant. Reads and writes go through the functions below.
revoke all on table public.coach_athlete_seen from public, anon, authenticated;
revoke all on table public.coach_athlete_events from public, anon, authenticated;

-- Writes -----------------------------------------------------------------------------

-- The coach opened the athlete's detail. p_seen_at is when that happened on the
-- phone, so an outbox item that flushes later does not swallow runs that arrived
-- in between. Null means now. A time in the future is cut to now(). The stored
-- value only moves forward, so a late or repeated flush changes nothing.
-- Returns the stored seen_at.
create or replace function public.coach_mark_athlete_seen(
  p_athlete uuid,
  p_seen_at timestamptz default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_seen timestamptz := least(coalesce(p_seen_at, now()), now());
  v_stored timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_athlete is null then
    raise exception 'missing athlete' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.coach_athlete_links l
    where l.coach_id = v_uid
      and l.athlete_id = p_athlete
      and l.status = 'active'
  ) then
    raise exception 'link_inactive' using errcode = 'P0001';
  end if;

  if not public.link_is_v2(v_uid, p_athlete) then
    raise exception 'v2_unavailable' using errcode = 'P0001';
  end if;

  insert into public.coach_athlete_seen as s (coach_id, athlete_id, seen_at, updated_at)
  values (v_uid, p_athlete, v_seen, now())
  on conflict (coach_id, athlete_id) do update
    set seen_at = greatest(s.seen_at, excluded.seen_at),
        updated_at = case when excluded.seen_at > s.seen_at then now() else s.updated_at end
  returning seen_at into v_stored;

  return v_stored;
end;
$$;

-- The signed-in athlete saved a new goal and plan. Logs goal_change for their
-- active coach link. Returns false, and writes nothing, when there is no active
-- link (C7.2 AC4). Raises v2_unavailable when the pair is not v2, so the outbox
-- keeps it. A repeated p_client_id returns true and stores no second row.
create or replace function public.athlete_log_goal_change(p_client_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_coach uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select l.coach_id
    into v_coach
  from public.coach_athlete_links l
  where l.athlete_id = v_uid
    and l.status = 'active';

  if not found then
    return false;
  end if;

  if not public.link_is_v2(v_coach, v_uid) then
    raise exception 'v2_unavailable' using errcode = 'P0001';
  end if;

  insert into public.coach_athlete_events (coach_id, athlete_id, kind, client_id)
  values (v_coach, v_uid, 'goal_change', p_client_id)
  on conflict (athlete_id, client_id) where client_id is not null do nothing;

  return true;
end;
$$;

-- Reads ------------------------------------------------------------------------------

-- The caller's own athlete only, newest first, at most 100. p_since null means
-- every event. Zero rows unless the caller is the active coach and the pair is v2.
create or replace function public.coach_get_athlete_events(
  p_athlete uuid,
  p_since timestamptz default null
)
returns table (
  id uuid,
  kind text,
  ref_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.kind, e.ref_id, e.created_at
  from public.coach_athlete_events e
  where auth.uid() is not null
    and e.coach_id = auth.uid()
    and e.athlete_id = p_athlete
    and public.is_active_coach_of(p_athlete)
    and public.link_is_v2(auth.uid(), p_athlete)
    and (p_since is null or e.created_at > p_since)
  order by e.created_at desc, e.id
  limit 100;
$$;

-- One row per active athlete of the caller whose pair is v2. See the header for
-- what counts as new. latest_event_kind is the newest counted event's kind (the
-- "Changed goal" / "Changed your workout" chip). oldest_new_at is the oldest
-- counted item, for the order inside the "New to review" group.
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
    0,
    0,
    coalesce(ec.n, 0),
    ec.latest_kind,
    case
      when rc.oldest is null then ec.oldest
      when ec.oldest is null then rc.oldest
      else least(rc.oldest, ec.oldest)
    end
  from pairs p
  left join run_counts rc on rc.athlete_id = p.athlete_id
  left join event_counts ec on ec.athlete_id = p.athlete_id
  order by p.athlete_id;
$$;

-- Function grants ----------------------------------------------------------------------

revoke all on function public.coach_mark_athlete_seen(uuid, timestamptz) from public, anon;
grant execute on function public.coach_mark_athlete_seen(uuid, timestamptz) to authenticated;

revoke all on function public.athlete_log_goal_change(uuid) from public, anon;
grant execute on function public.athlete_log_goal_change(uuid) to authenticated;

revoke all on function public.coach_get_athlete_events(uuid, timestamptz) from public, anon;
grant execute on function public.coach_get_athlete_events(uuid, timestamptz) to authenticated;

revoke all on function public.coach_roster_summary() from public, anon;
grant execute on function public.coach_roster_summary() to authenticated;

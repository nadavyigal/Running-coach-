-- Coach Experience v2, story C7.5: coach and athlete push sender.
-- M2b, Batch B.
--
-- Do not apply this to production from the app PR. Nadav applies
-- 20261122110000_notification_log_and_deferred.sql himself, in Batch B, after M2a
-- (20261122100000_push_tokens_and_prefs.sql), together with the four Database
-- Webhooks, the flush cron and the coach_notify deploy
-- (docs/coach-v2-batch-b-runbook.md). Mirror it to the web repo Running-coach- at
-- v0/supabase/migrations/. Do not apply an older copy.
--
-- "Coach" here means a HUMAN coach (Coach Mode). It is unrelated to the AI coach
-- (coach_message, coaching_style).
--
-- Depends on: M2a (notification_prefs, push_tokens; read by the sender, not here),
-- M0 (link_is_v2), M5a (coach_v2_sharing_allowed), Story 1.3
-- (coach_athlete_links, coach_profiles), coach_read_rpcs (athlete_display_name).
--
-- What this file creates (all server-only: RLS on, no client grant, no client
-- policy; only service_role, which the coach_notify Edge Function uses, can touch
-- them):
--   coach_notification_log   one row per push the sender decided to send (C7.5
--                            AC12). The source for dedupe, the burst limit and the
--                            push metrics. Holds ids, a kind and an outcome: never
--                            a name, a note, a flag or a reply text.
--   deferred_pushes          pushes held back: 'quiet' (the recipient's quiet
--                            hours, AC7) or 'burst' (more than 3 run-finished
--                            pushes to one coach in 10 minutes, AC3). The flush
--                            sends one collapsed push per recipient and deletes
--                            the rows. Holds ids only.
--   coach_notify_link_state(p_athlete)   the athlete's active link, both v2 gates
--                            and the two display names, read at send time (AC9).
--   coach_notify_claim(...)  atomic "may I send this?": idempotency per event,
--                            the 30-minute per-athlete dedupe (D6, AC2) and the
--                            burst limit (AC3). It writes the log row it allows.
--   coach_notify_defer(...)  atomic "hold this for later": idempotency and the same
--                            dedupe, then a 'quiet' deferred row.
--
-- Both claim and defer take a transaction advisory lock per recipient, so two
-- webhook calls at the same moment (a Garmin and a HealthKit copy of one run) can
-- not both pass the dedupe.
--
-- Queued and deferred rows are not deleted by link end, the kill switch or a
-- rollback (v1.3 §3.1, §3.7). The sender re-checks the link at send time and
-- drops the rows whose link is gone (AC9). With coach_v2_push or coach_v2 off it
-- sends nothing and keeps every row (AC10).
--
-- Account deletion: every user column references auth.users with
-- on delete cascade, so delete_account (which deletes the auth user last) removes a
-- deleted user's log and deferred rows, as recipient, athlete or coach.
-- purge_coach_data_for_deleted_account is not replaced.
--
-- Idempotent: tables and indexes are create if not exists, constraints are added
-- once, functions are create or replace, grants are restated.
--
-- Rollback: supabase/rollback/20261122110000_notification_log_and_deferred.sql
-- (drops the three functions, keeps both tables and their rows). Runbook:
-- docs/coach-v2-rollback.md.

-- Tables -----------------------------------------------------------------------

create table if not exists public.coach_notification_log (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  -- The athlete the push is about (or, for an athlete push, the recipient).
  -- Null for a collapsed push about several athletes.
  athlete_id uuid references auth.users(id) on delete cascade,
  kind text not null,
  -- The source row id (runs.id, athlete_run_flags.id, coach_feedback.id,
  -- coach_feedback_replies.id). Null for a collapsed push.
  ref_id text,
  sent_at timestamptz not null default now(),
  -- How many events one push stands for: 1, or the size of a collapsed push.
  item_count integer not null default 1,
  -- 'pending' until the APNs answer is in.
  outcome text not null default 'pending'
);

create table if not exists public.deferred_pushes (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  -- Ids only, never text. The routing target of the single push it replaced.
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  -- The link the event happened on. The flush drops the row when this is no
  -- longer the pair's active link (AC9), so a rejoin never delivers old events.
  link_id uuid not null,
  ref_id text,
  reason text not null,
  -- 'burst' rows: the end of the 10-minute window. Null for 'quiet' rows, which
  -- are due as soon as the recipient is out of quiet hours in their current zone.
  deliver_after timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'coach_notification_log_kind'
      and conrelid = 'public.coach_notification_log'::regclass
  ) then
    -- Every remote kind but selfTest (push_selftest never logs), so later senders
    -- (C7.6, C8.16, C8.12) need no new constraint. Mirrors REMOTE_PUSH_KINDS in
    -- supabase/functions/_shared/apns.ts.
    alter table public.coach_notification_log
      add constraint coach_notification_log_kind check (kind in (
        'coachRunFinished', 'coachEveningSummary', 'coachPainFlag', 'athleteCoachNote',
        'athleteCoachReply', 'athletePlanPublished', 'athletePlanUpdated', 'athleteBroadcast',
        'coachDigest', 'athleteNotesDigest'
      ));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'coach_notification_log_outcome'
      and conrelid = 'public.coach_notification_log'::regclass
  ) then
    alter table public.coach_notification_log
      add constraint coach_notification_log_outcome
      check (outcome in ('pending', 'sent', 'failed', 'no_device'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'coach_notification_log_shape'
      and conrelid = 'public.coach_notification_log'::regclass
  ) then
    alter table public.coach_notification_log
      add constraint coach_notification_log_shape check (
        item_count between 1 and 10000
        and (ref_id is null or ref_id ~ '^[0-9A-Za-z-]{1,64}$')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'deferred_pushes_kind'
      and conrelid = 'public.deferred_pushes'::regclass
  ) then
    alter table public.deferred_pushes
      add constraint deferred_pushes_kind check (kind in (
        'coachRunFinished', 'coachEveningSummary', 'coachPainFlag', 'athleteCoachNote',
        'athleteCoachReply', 'athletePlanPublished', 'athletePlanUpdated', 'athleteBroadcast'
      ));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'deferred_pushes_shape'
      and conrelid = 'public.deferred_pushes'::regclass
  ) then
    alter table public.deferred_pushes
      add constraint deferred_pushes_shape check (
        reason in ('quiet', 'burst')
        and (reason = 'quiet') = (deliver_after is null)
        and jsonb_typeof(payload) = 'object'
        and octet_length(payload::text) <= 1024
        and (ref_id is null or ref_id ~ '^[0-9A-Za-z-]{1,64}$')
      );
  end if;
end $$;

-- One log row per event and recipient: a retried webhook finds it and sends nothing.
create unique index if not exists coach_notification_log_event_key
  on public.coach_notification_log (recipient_id, kind, ref_id)
  where ref_id is not null;

-- The 30-minute per-athlete dedupe.
create index if not exists coach_notification_log_dedupe_idx
  on public.coach_notification_log (recipient_id, athlete_id, kind, sent_at desc);

-- The burst limit (recent sends of one kind to one recipient) and the metrics.
create index if not exists coach_notification_log_recipient_kind_idx
  on public.coach_notification_log (recipient_id, kind, sent_at desc);

-- One deferred row per event and recipient.
create unique index if not exists deferred_pushes_event_key
  on public.deferred_pushes (recipient_id, kind, ref_id)
  where ref_id is not null;

-- The flush reads every recipient's rows; the dedupe reads one athlete's.
create index if not exists deferred_pushes_recipient_idx
  on public.deferred_pushes (recipient_id, created_at);
create index if not exists deferred_pushes_dedupe_idx
  on public.deferred_pushes (recipient_id, athlete_id, kind, created_at desc);

-- RLS and table grants: server-only -----------------------------------------------

alter table public.coach_notification_log enable row level security;
alter table public.deferred_pushes enable row level security;

-- No client role gets any table privilege and no policy exists, so a signed-in or
-- anonymous client reads and writes nothing.
revoke all on table public.coach_notification_log from public, anon, authenticated;
revoke all on table public.deferred_pushes from public, anon, authenticated;

-- The sender runs as service_role (bypasses RLS). These grants only make the table
-- access explicit on databases without Supabase's default privileges.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on table public.coach_notification_log to service_role;
    grant select, insert, delete on table public.deferred_pushes to service_role;
  end if;
end $$;

-- Functions --------------------------------------------------------------------

-- The athlete's one active link, read at send time (C7.5 AC9). Zero rows when the
-- athlete has no active link. link_v2 is link_is_v2 (kill switch, both clients v2,
-- allowlist); sharing_allowed adds the athlete's v2 consent ack (C7.8). Names are
-- what the coach roster and the athlete's "My coach" show: profiles.name (blank
-- becomes 'Athlete') and coach_profiles.display_name.
create or replace function public.coach_notify_link_state(p_athlete uuid)
returns table (
  link_id uuid,
  coach_id uuid,
  link_v2 boolean,
  sharing_allowed boolean,
  coach_name text,
  athlete_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id,
    l.coach_id,
    public.link_is_v2(l.coach_id, l.athlete_id),
    public.coach_v2_sharing_allowed(l.coach_id, l.athlete_id),
    coalesce(nullif(btrim(cp.display_name), ''), 'Your coach'),
    public.athlete_display_name(l.athlete_id)
  from public.coach_athlete_links l
  left join public.coach_profiles cp on cp.user_id = l.coach_id
  where l.athlete_id = p_athlete
    and l.status = 'active'
  limit 1;
$$;

-- "May I send this push now?" Under a per-recipient lock:
--   'duplicate'  this event (recipient, kind, ref_id) was already logged or
--                deferred: a retried webhook. Nothing changes.
--   'deduped'    p_dedupe_seconds > 0 and a push of this kind about this athlete
--                went to this recipient (or is deferred for them) within the
--                window (D6: one run-finished per athlete per coach per 30 min).
--                Nothing is written.
--   'deferred_burst'  p_burst_limit is set and the recipient already got that many
--                pushes of this kind in the last p_burst_seconds, or a burst is
--                already being collected: a 'burst' deferred row is written, due
--                at the end of the window (AC3).
--   'claimed'    a log row is written (outcome 'pending'); log_id is its id. The
--                caller sends and then records the outcome.
create or replace function public.coach_notify_claim(
  p_recipient uuid,
  p_athlete uuid,
  p_link_id uuid,
  p_kind text,
  p_ref_id text,
  p_dedupe_seconds integer default 0,
  p_burst_limit integer default null,
  p_burst_seconds integer default null
)
returns table (decision text, log_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_recent integer;
  v_first timestamptz;
  v_due timestamptz;
  v_id uuid;
begin
  if p_recipient is null or p_athlete is null or p_link_id is null or p_kind is null then
    raise exception 'missing_argument' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('coach_notify:' || p_recipient::text, 0)
  );

  if p_ref_id is not null and (
    exists (
      select 1 from public.coach_notification_log g
      where g.recipient_id = p_recipient and g.kind = p_kind and g.ref_id = p_ref_id
    )
    or exists (
      select 1 from public.deferred_pushes d
      where d.recipient_id = p_recipient and d.kind = p_kind and d.ref_id = p_ref_id
    )
  ) then
    return query select 'duplicate'::text, null::uuid;
    return;
  end if;

  if coalesce(p_dedupe_seconds, 0) > 0 then
    v_window_start := now() - make_interval(secs => p_dedupe_seconds);
    if exists (
      select 1 from public.coach_notification_log g
      where g.recipient_id = p_recipient and g.athlete_id = p_athlete
        and g.kind = p_kind and g.sent_at > v_window_start
    ) or exists (
      select 1 from public.deferred_pushes d
      where d.recipient_id = p_recipient and d.athlete_id = p_athlete
        and d.kind = p_kind and d.created_at > v_window_start
    ) then
      return query select 'deduped'::text, null::uuid;
      return;
    end if;
  end if;

  if p_burst_limit is not null and coalesce(p_burst_seconds, 0) > 0 then
    -- A burst already being collected for this recipient: join it.
    select min(d.deliver_after) into v_due
    from public.deferred_pushes d
    where d.recipient_id = p_recipient and d.kind = p_kind
      and d.reason = 'burst' and d.deliver_after > now();

    if v_due is null then
      select count(*), min(g.sent_at) into v_recent, v_first
      from public.coach_notification_log g
      where g.recipient_id = p_recipient and g.kind = p_kind
        and g.sent_at > now() - make_interval(secs => p_burst_seconds);
      if v_recent >= p_burst_limit then
        v_due := v_first + make_interval(secs => p_burst_seconds);
      end if;
    end if;

    if v_due is not null then
      insert into public.deferred_pushes
        (recipient_id, kind, athlete_id, coach_id, link_id, ref_id, reason, deliver_after)
      select p_recipient, p_kind, p_athlete, l.coach_id, p_link_id, p_ref_id, 'burst', v_due
      from public.coach_athlete_links l
      where l.id = p_link_id;
      return query select 'deferred_burst'::text, null::uuid;
      return;
    end if;
  end if;

  insert into public.coach_notification_log (recipient_id, athlete_id, kind, ref_id)
  values (p_recipient, p_athlete, p_kind, p_ref_id)
  returning id into v_id;

  return query select 'claimed'::text, v_id;
end;
$$;

-- "Hold this push until the recipient's quiet hours end" (AC7). Same lock, same
-- 'duplicate' and 'deduped' rules as coach_notify_claim, then a 'quiet' row:
-- 'deferred'. p_payload holds ids only.
create or replace function public.coach_notify_defer(
  p_recipient uuid,
  p_athlete uuid,
  p_link_id uuid,
  p_kind text,
  p_ref_id text,
  p_dedupe_seconds integer default 0,
  p_payload jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_coach uuid;
begin
  if p_recipient is null or p_athlete is null or p_link_id is null or p_kind is null then
    raise exception 'missing_argument' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('coach_notify:' || p_recipient::text, 0)
  );

  if p_ref_id is not null and (
    exists (
      select 1 from public.coach_notification_log g
      where g.recipient_id = p_recipient and g.kind = p_kind and g.ref_id = p_ref_id
    )
    or exists (
      select 1 from public.deferred_pushes d
      where d.recipient_id = p_recipient and d.kind = p_kind and d.ref_id = p_ref_id
    )
  ) then
    return 'duplicate';
  end if;

  if coalesce(p_dedupe_seconds, 0) > 0 then
    v_window_start := now() - make_interval(secs => p_dedupe_seconds);
    if exists (
      select 1 from public.coach_notification_log g
      where g.recipient_id = p_recipient and g.athlete_id = p_athlete
        and g.kind = p_kind and g.sent_at > v_window_start
    ) or exists (
      select 1 from public.deferred_pushes d
      where d.recipient_id = p_recipient and d.athlete_id = p_athlete
        and d.kind = p_kind and d.created_at > v_window_start
    ) then
      return 'deduped';
    end if;
  end if;

  select l.coach_id into v_coach from public.coach_athlete_links l where l.id = p_link_id;
  if v_coach is null then
    raise exception 'link_missing' using errcode = 'P0002';
  end if;

  insert into public.deferred_pushes
    (recipient_id, kind, payload, athlete_id, coach_id, link_id, ref_id, reason, deliver_after)
  values
    (p_recipient, p_kind, coalesce(p_payload, '{}'::jsonb), p_athlete, v_coach, p_link_id,
     p_ref_id, 'quiet', null);
  return 'deferred';
end;
$$;

-- Function grants: service_role only ------------------------------------------------

revoke all on function public.coach_notify_link_state(uuid) from public, anon, authenticated;
revoke all on function public.coach_notify_claim(uuid, uuid, uuid, text, text, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.coach_notify_defer(uuid, uuid, uuid, text, text, integer, jsonb)
  from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.coach_notify_link_state(uuid) to service_role;
    grant execute on function public.coach_notify_claim(uuid, uuid, uuid, text, text, integer, integer, integer)
      to service_role;
    grant execute on function public.coach_notify_defer(uuid, uuid, uuid, text, text, integer, jsonb)
      to service_role;
  end if;
end $$;

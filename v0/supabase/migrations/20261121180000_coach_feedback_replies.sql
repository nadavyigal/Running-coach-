-- Coach Experience v2, story C7.7: the athlete replies to a coach note, one level.
-- M4, Batch A.
--
-- Do not apply this to production from the app PR. Nadav applies
-- 20261121180000_coach_feedback_replies.sql himself, in Batch A, after
-- 20261121100000_coach_v2_gate.sql, 20261121110000_coach_consent_v2.sql,
-- 20261121120000_athlete_run_sharing.sql, 20261121130000_coach_last_seen_and_events.sql
-- and 20261121150000_athlete_run_flags.sql (and after M5b / M13 when they are merged),
-- the Grok Bot audit and the 1.2.6 regression. Mirror it to the web repo
-- Running-coach- at v0/supabase/migrations/. Do not apply an older copy.
--
-- File name: the v1.3 plan reserved 20261121140000 for M4. That sorts before M1b
-- (20261121150000), which also replaces coach_roster_summary and
-- purge_coach_data_for_deleted_account, so M1b would overwrite this file's versions
-- when applied in timestamp order. M4 is renamed to 20261121180000 (unapplied, so the
-- rename is allowed by v1.3 section 1.1).
--
-- "Coach" here means a HUMAN coach (Coach Mode). It is unrelated to the AI coach
-- (coach_message, coaching_style).
--
-- A reply is the athlete's own words to their coach. It reaches the coach only through
-- the security-definer read below, and only while coach_v2_sharing_allowed holds
-- (link_is_v2 AND consent v2 acked). No plan, AI or flex-week code reads this table.
--
-- Depends on Story 1.3 (coach_athlete_links), Story 1.5
-- (purge_coach_data_for_deleted_account), Story 2.2 (is_active_coach_of), Story 3.1
-- (coach_feedback), Story 3.4 (coach_feedback.kind: 'note' or 'welcome'), C7.0
-- (link_is_v2), C7.8 (coach_v2_sharing_allowed), C7.3 (athlete_sharing_ack_time),
-- C7.2 (coach_athlete_seen, coach_roster_summary) and C7.4 (its coach_roster_summary
-- and purge replacements, kept in full below).
--
-- What this file adds:
--   coach_feedback_replies             one row per reply: the note it answers, the
--                                      author (the note's athlete), the link it was
--                                      sent on, text of 1 to 1000 characters.
--   athlete_reply_to_feedback(p_feedback_id, p_text, p_id)
--                                      athlete write, idempotent by the client id p_id.
--   my_feedback_replies()              athlete read of their own replies, also after
--                                      leaving (C7.7 AC6: replies stay readable).
--   coach_get_feedback_replies(p_athlete_ids)
--                                      coach read, under the note in the day detail
--                                      and week note (AC4).
--   coach_mark_reply_read(p_reply_ids) coach read receipt, sets read_at once.
--   coach_roster_summary()             C7.4's read, same signature, now fills
--                                      new_replies (AC4: replies count as "new").
--   purge_coach_data_for_deleted_account  C7.4's purge plus the replies block.
--
-- One level only (AC5): a reply has no parent reply column, and the write raises
-- reply_to_reply when p_feedback_id names a reply. The coach answers with a new note.
--
-- The welcome note (Story 3.4) is a coach_feedback row with kind = 'welcome', so the
-- athlete may reply to it (v1.3 C7.7 "Claude checks first", 7.5 assumption). Any other
-- kind (a future C8.12 broadcast) raises reply_not_allowed (AC8).
--
-- my_coach_feedback() is NOT reshaped. 1.2.6 clients call it, and its current shape
-- is Story 3.4's. Replies come from their own reads instead (deviation from the v1.3
-- section 3.1 wording "extend my_coach_feedback", same data).
--
-- A reply belongs to the link it was sent on (link_id), like C7.4's flags. After a
-- leave, a removal or a rejoin (join_coach inserts a new link row) the coach sees none
-- of the earlier replies. The athlete always sees their own replies (owner select and
-- my_feedback_replies).
--
-- Gates:
--   * athlete_reply_to_feedback: the note must be the caller's and from the coach of
--     their active link, else link_inactive (the link to that note's coach is gone).
--     Then C7.3's athlete_sharing_ack_time: v2_unavailable (keep queued) and
--     consent_required.
--   * Coach reads return zero rows unless the caller is the active coach on the
--     reply's own link and coach_v2_sharing_allowed holds.
--   * coach_mark_reply_read never raises for a gate: it only marks replies the coach
--     can read right now and returns how many it marked (0 with the kill switch on).
--     It is a best-effort read receipt, not an outboxed action.
--
-- Errors the app's outbox reads (v1.3 section 1.1):
--   v2_unavailable                                keep the reply queued.
--   link_inactive                                 drop it; show "You're no longer
--                                                 linked to {Coach}, so this reply
--                                                 wasn't sent." (AC7).
--   consent_required, bad_reply_id, reply_empty, reply_too_long, reply_to_reply,
--   reply_not_allowed, feedback_not_found         drop it (errcode 22023 for input).
--
-- Account deletion: author_id is on delete cascade from auth.users, feedback_id is on
-- delete cascade from coach_feedback, and the purge deletes the user's replies and the
-- replies on the user's notes. Link end: rows stay; every coach read needs the reply's
-- link to be active. C7.11 adds coach_get_feedback_replies to its parity test.
--
-- Idempotent: the table and indexes are create if not exists, checks and the policy
-- are added only when missing, functions are create or replace, grants are restated.
--
-- Rollback: supabase/rollback/20261121180000_coach_feedback_replies.sql (drops the four
-- reply functions, restores C7.4's coach_roster_summary and purge, keeps the table and
-- its rows). Runbook: docs/coach-v2-rollback.md.

-- Table ------------------------------------------------------------------------------

create table if not exists public.coach_feedback_replies (
  -- Made on the phone and sent as p_id, so a retried flush stores one row.
  id uuid primary key,
  feedback_id uuid not null references public.coach_feedback(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  -- The link the reply was sent on. Null only after the link row was deleted.
  link_id uuid references public.coach_athlete_links(id) on delete set null,
  text text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'coach_feedback_replies_text_length'
      and conrelid = 'public.coach_feedback_replies'::regclass
  ) then
    alter table public.coach_feedback_replies
      add constraint coach_feedback_replies_text_length
      check (length(btrim(text)) > 0 and char_length(text) <= 1000);
  end if;
end $$;

create index if not exists coach_feedback_replies_feedback_created
  on public.coach_feedback_replies (feedback_id, created_at);

create index if not exists coach_feedback_replies_link_created
  on public.coach_feedback_replies (link_id, created_at);

create index if not exists coach_feedback_replies_author_created
  on public.coach_feedback_replies (author_id, created_at desc);

-- RLS and table grants ----------------------------------------------------------------

alter table public.coach_feedback_replies enable row level security;

revoke all on table public.coach_feedback_replies from public, anon, authenticated;
-- The athlete reads their own replies. No client write: every write is an RPC below.
grant select on table public.coach_feedback_replies to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'coach_feedback_replies'
      and policyname = 'coach_feedback_replies_owner_select'
  ) then
    create policy coach_feedback_replies_owner_select on public.coach_feedback_replies
      for select to authenticated
      using (author_id = (select auth.uid()));
  end if;
end $$;

-- Athlete write -----------------------------------------------------------------------

-- P6 "Reply" under a coach note. Returns 'sent'. A repeated p_id returns 'sent' and
-- changes nothing, even after the link ended: the first write stands.
create or replace function public.athlete_reply_to_feedback(
  p_feedback_id uuid,
  p_text text,
  p_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_text text := regexp_replace(coalesce(p_text, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_existing public.coach_feedback_replies%rowtype;
  v_coach uuid;
  v_kind text;
  v_link uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'bad_reply_id' using errcode = '22023';
  end if;

  -- A retried flush: the first write stands.
  select * into v_existing from public.coach_feedback_replies r where r.id = p_id;
  if found then
    if v_existing.author_id <> v_uid or v_existing.feedback_id is distinct from p_feedback_id then
      raise exception 'bad_reply_id' using errcode = '22023';
    end if;
    return 'sent';
  end if;

  if v_text = '' then
    raise exception 'reply_empty' using errcode = '22023';
  end if;
  if char_length(v_text) > 1000 then
    raise exception 'reply_too_long' using errcode = '22023';
  end if;

  -- AC5: replies have no parent reply.
  if exists (select 1 from public.coach_feedback_replies r where r.id = p_feedback_id) then
    raise exception 'reply_to_reply' using errcode = '22023';
  end if;

  select f.coach_id, f.kind into v_coach, v_kind
  from public.coach_feedback f
  where f.id = p_feedback_id
    and f.athlete_id = v_uid;
  if not found then
    raise exception 'feedback_not_found' using errcode = '22023';
  end if;
  -- AC8: notes and the welcome take replies; nothing else does (C8.12 broadcasts).
  if v_kind not in ('note', 'welcome') then
    raise exception 'reply_not_allowed' using errcode = '22023';
  end if;

  -- The note's coach must be the coach of the caller's active link (AC6, AC7).
  select l.id into v_link
  from public.coach_athlete_links l
  where l.athlete_id = v_uid
    and l.coach_id = v_coach
    and l.status = 'active';
  if not found then
    raise exception 'link_inactive' using errcode = 'P0001';
  end if;

  -- v2_unavailable / consent_required, as for effort, notes and flags.
  perform public.athlete_sharing_ack_time();

  insert into public.coach_feedback_replies (id, feedback_id, author_id, link_id, text)
  values (p_id, p_feedback_id, v_uid, v_link, v_text)
  on conflict (id) do nothing;

  -- Lost a race with a concurrent flush of the same id: answer from the stored row.
  select * into v_existing from public.coach_feedback_replies r where r.id = p_id;
  if v_existing.author_id <> v_uid or v_existing.feedback_id is distinct from p_feedback_id then
    raise exception 'bad_reply_id' using errcode = '22023';
  end if;
  return 'sent';
end;
$$;

-- Athlete read ------------------------------------------------------------------------

-- The caller's own replies, oldest first. Works after leaving (AC6) and with the kill
-- switch on: it is the athlete's own text, like the owner-select policy.
create or replace function public.my_feedback_replies()
returns table (
  id uuid,
  feedback_id uuid,
  text text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return query
  select r.id, r.feedback_id, r.text, r.created_at
  from public.coach_feedback_replies r
  where r.author_id = auth.uid()
  order by r.created_at, r.id
  limit 1000;
end;
$$;

-- Coach read --------------------------------------------------------------------------

-- Replies from the caller's active athletes, on each athlete's current link only, to
-- this coach's own notes. Oldest first, at most 1000 rows. text is the athlete's
-- words, shown verbatim to the coach only.
create or replace function public.coach_get_feedback_replies(
  p_athlete_ids uuid[] default null
)
returns table (
  id uuid,
  feedback_id uuid,
  athlete_id uuid,
  text text,
  created_at timestamptz,
  read_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.feedback_id,
    r.author_id,
    r.text,
    r.created_at,
    r.read_at
  from public.coach_athlete_links l
  join public.coach_feedback_replies r
    on r.link_id = l.id
   and r.author_id = l.athlete_id
  join public.coach_feedback f
    on f.id = r.feedback_id
   and f.coach_id = l.coach_id
   and f.athlete_id = l.athlete_id
  where auth.uid() is not null
    and l.coach_id = auth.uid()
    and l.status = 'active'
    and public.is_active_coach_of(l.athlete_id)
    and public.coach_v2_sharing_allowed(l.coach_id, l.athlete_id)
    and (p_athlete_ids is null or l.athlete_id = any (p_athlete_ids))
  order by r.created_at, r.id
  limit 1000;
$$;

-- Coach read receipt ---------------------------------------------------------------------

-- Sets read_at once on the replies the coach can read right now (same gate as the
-- read). Returns how many it marked. Never raises for a gate; never touches text.
create or replace function public.coach_mark_reply_read(p_reply_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_reply_ids is null or cardinality(p_reply_ids) = 0 then
    return 0;
  end if;

  update public.coach_feedback_replies r
     set read_at = now()
    from public.coach_athlete_links l, public.coach_feedback f
   where r.id = any (p_reply_ids)
     and r.read_at is null
     and l.id = r.link_id
     and l.athlete_id = r.author_id
     and l.coach_id = v_uid
     and l.status = 'active'
     and f.id = r.feedback_id
     and f.coach_id = v_uid
     and public.coach_v2_sharing_allowed(l.coach_id, l.athlete_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Coach Today counts ------------------------------------------------------------------------

-- C7.4's function with the same signature and every C7.2 and C7.4 rule kept (v2 pairs
-- only, 7-day baseline, no future runs, left/removed never counted, open flags on the
-- current link while sharing). New here: new_replies counts replies on the athlete's
-- current link, to this coach's notes, created after the baseline, only while
-- coach_v2_sharing_allowed holds, and oldest_new_at considers them.
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
  reply_counts as (
    select p.athlete_id, count(r.id)::integer as n, min(r.created_at) as oldest
    from pairs p
    join public.coach_feedback_replies r
      on r.link_id = p.link_id
     and r.author_id = p.athlete_id
     and r.created_at > p.baseline
    join public.coach_feedback cf
      on cf.id = r.feedback_id
     and cf.coach_id = p.coach_id
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
    coalesce(pc.n, 0),
    coalesce(ec.n, 0),
    ec.latest_kind,
    (select min(t) from (values (rc.oldest), (fc.oldest), (pc.oldest), (ec.oldest)) v(t))
  from pairs p
  left join run_counts rc on rc.athlete_id = p.athlete_id
  left join flag_counts fc on fc.athlete_id = p.athlete_id
  left join reply_counts pc on pc.athlete_id = p.athlete_id
  left join event_counts ec on ec.athlete_id = p.athlete_id
  order by p.athlete_id;
$$;

-- Account deletion ----------------------------------------------------------------------------

-- C7.4's purge (Story 1.5, the C7.3 block and the C7.4 block), unchanged, plus the C7.7
-- block. A later migration that replaces this function must keep every block below.
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

  -- C7.7: replies first, while their notes still exist. As the athlete their replies
  -- go; as the coach the replies to their notes go with the notes.
  if to_regclass('public.coach_feedback_replies') is not null then
    delete from public.coach_feedback_replies r
    where r.author_id = p_user_id
       or exists (
         select 1 from public.coach_feedback f
         where f.id = r.feedback_id
           and (f.coach_id = p_user_id or f.athlete_id = p_user_id)
       );
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

revoke all on function public.athlete_reply_to_feedback(uuid, text, uuid) from public, anon;
grant execute on function public.athlete_reply_to_feedback(uuid, text, uuid) to authenticated;

revoke all on function public.my_feedback_replies() from public, anon;
grant execute on function public.my_feedback_replies() to authenticated;

revoke all on function public.coach_get_feedback_replies(uuid[]) from public, anon;
grant execute on function public.coach_get_feedback_replies(uuid[]) to authenticated;

revoke all on function public.coach_mark_reply_read(uuid[]) from public, anon;
grant execute on function public.coach_mark_reply_read(uuid[]) to authenticated;

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
  v_replies bigint;
begin
  select count(*) into v_replies from public.coach_feedback_replies;
  raise notice 'coach_feedback_replies: % rows (no backfill here)', v_replies;
end $$;

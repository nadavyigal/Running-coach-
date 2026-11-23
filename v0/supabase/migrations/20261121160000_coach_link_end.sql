-- Coach Experience v2, story C7.11: the coach removes an athlete (decision D8).
-- M5b, Batch A.
--
-- Do not apply this to production from the app PR. Nadav applies
-- 20261121160000_coach_link_end.sql himself, in Batch A, after
-- 20261121100000_coach_v2_gate.sql, 20261121110000_coach_consent_v2.sql,
-- 20261121120000_athlete_run_sharing.sql and
-- 20261121130000_coach_last_seen_and_events.sql (and M4/M1b if they are
-- applied in the same batch), the Grok Bot audit and the 1.2.6 regression.
-- Mirror it to the web repo Running-coach- at v0/supabase/migrations/. Do not
-- apply an older copy.
--
-- "Coach" here means a HUMAN coach (Coach Mode). It is unrelated to the AI coach
-- (coach_message, coaching_style).
--
-- Depends on Story 1.3 (coach_athlete_links), Story 1.5 (leave_coach, which this
-- file replaces), Story 2.2 (is_active_coach_of), C7.0 (runtime_flags,
-- client_capabilities) and C7.2 (coach_athlete_events, which already allows the
-- kinds left and removed).
--
-- What this file creates or changes:
--   coach_athlete_links.ended_by              'athlete' or 'coach'. Null for an
--                                             active link and for links revoked
--                                             before this file.
--   coach_athlete_links.ended_notice_seen_at  when the athlete saw the removal
--                                             line. Null until then.
--   end_coach_link(p_link_id, p_ended_by)     internal. The one place a link ends.
--                                             Revokes an active link (status,
--                                             revoked_at, ended_by) and logs left
--                                             or removed in coach_athlete_events.
--                                             Not callable by clients.
--   leave_coach(expected_link_id)             create or replace, same signature
--                                             and return type (void) as Story 1.5,
--                                             because 1.2.6 clients call it. Same
--                                             errors: not authenticated (42501),
--                                             not_linked (P0001). Now routes
--                                             through end_coach_link(.., 'athlete').
--   coach_remove_athlete(p_athlete)           coach write. Ends the caller's
--                                             active link with p_athlete through
--                                             end_coach_link(.., 'coach').
--   my_coach_link_notice()                    athlete read. The one removal line
--                                             still to show, with the coach's name.
--   mark_link_notice_seen(p_link_id)          athlete write. Shows the line once.
--   coach_link_notice_allowed(p_user)         internal. The gate for the two
--                                             notice RPCs (see Gates).
--
-- Gates:
--   * coach_remove_athlete does NOT check link_is_v2 (C7.11 AC1): a coach can
--     remove an athlete on any build, and the kill switch never blocks ending a
--     link, the same as leave_coach. It needs is_active_coach_of: a non-coach or
--     another coach gets not_linked (P0001). A repeated remove by the same coach,
--     after the link already ended, returns 'already_ended' and changes nothing.
--   * The notice RPCs are v2 surfaces. my_coach_link_notice returns zero rows
--     and mark_link_notice_seen raises v2_unavailable while runtime_flags.coach_v2
--     is off, or when the athlete has not reported coach_v2 = true (a 1.2.6
--     athlete keeps the MVP behavior, C7.11 AC5). link_is_v2 cannot be used here:
--     it needs an active link, and these links have ended. A notice not seen
--     while the switch is off still shows once when it is back on.
--   * The notice is only for removals (ended_by = 'coach'). An athlete who left
--     sees nothing. It shows only while the removed link is the athlete's newest
--     link: once they join a coach again, the old line is gone.
--   * No push is sent from here (C7.11 AC5). Queued coach actions for the
--     athlete hit link_inactive on the server, as every v2 write already checks
--     the active link (C7.11 AC7).
--
-- Out of scope, added later as new create or replace files of end_coach_link
-- (v1.3 section 3.1): lock release in M6b (C8.1b) and draft deletion in M7
-- (C8.6). This file references no table or column that does not exist yet.
-- The Story 1.5 "STORY 4.2 HOOK" comment in leave_coach moves to end_coach_link.
--
-- Rows stay at link end: feedback, run notes, seen times and events are not
-- deleted. Every coach read needs an active link, so a removed athlete returns
-- zero rows from every coach read (parity test in supabase/tests/coach_link_end.sql).
--
-- Account deletion: the two new columns live on coach_athlete_links, which
-- purge_coach_data_for_deleted_account already deletes. It is not replaced here.
--
-- Idempotent: columns are add if not exists, the check is added only when
-- missing, functions are create or replace, grants are restated.
--
-- Rollback: supabase/rollback/20261121160000_coach_link_end.sql (restores the
-- Story 1.5 leave_coach, drops the five new functions, keeps both columns and
-- their values). Runbook: docs/coach-v2-rollback.md.

-- Columns -------------------------------------------------------------------------

alter table public.coach_athlete_links
  add column if not exists ended_by text,
  add column if not exists ended_notice_seen_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'coach_athlete_links_ended_by'
      and conrelid = 'public.coach_athlete_links'::regclass
  ) then
    alter table public.coach_athlete_links
      add constraint coach_athlete_links_ended_by
      check (ended_by is null or ended_by in ('athlete', 'coach'));
  end if;
end $$;

-- The coach and athlete SELECT policies from Story 1.5 are unchanged: the athlete
-- reads their own rows in every status (so ended_by is visible to them), the
-- coach reads only active links.

-- end_coach_link ----------------------------------------------------------------------

-- Ends one active link. Returns true when this call ended it, false when it was
-- already revoked or does not exist. Callers do their own authorization first:
-- this function trusts p_link_id. Not granted to any client role.
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

  -- Later create or replace files add here, in this order: M6b (C8.1b) clears
  -- locked / coach_published on this athlete's future workouts; M7 (C8.6)
  -- deletes this athlete's drafts for v_coach. Neither table or column exists
  -- yet, so this version must not touch them.

  return true;
end;
$$;

-- leave_coach (Story 1.5 signature, kept for 1.2.6 clients) ------------------------------

-- Same parameter name, type and void return as Story 1.5. The link must be the
-- caller's own active link with exactly this id, or not_linked, as before.
create or replace function public.leave_coach(expected_link_id uuid)
returns void
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

-- coach_remove_athlete ---------------------------------------------------------------------

-- The signed-in coach ends their active link with p_athlete. Returns 'removed'
-- when this call ended it, 'already_ended' when this coach's link with the
-- athlete had already ended (a retried tap or a lost response). Any other caller
-- gets not_linked. No link_is_v2 check (see header).
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

-- Removal notice (athlete side) ------------------------------------------------------------

-- True when the caller may see v2 surfaces after a link ended: the kill switch
-- is off (coach_v2 enabled) and the caller reported a v2 client. Internal.
create or replace function public.coach_link_notice_allowed(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null
    and exists (
      select 1 from public.runtime_flags f
      where f.key = 'coach_v2' and f.enabled
    )
    and exists (
      select 1 from public.client_capabilities c
      where c.user_id = p_user and c.coach_v2
    );
$$;

-- The removal line still to show the signed-in athlete: at most one row. Zero
-- rows when the newest link was not ended by the coach, was already seen, or is
-- still active, and while the gate above is closed.
create or replace function public.my_coach_link_notice()
returns table (
  link_id uuid,
  coach_name text,
  ended_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, coalesce(nullif(btrim(cp.display_name), ''), 'Your coach'), l.revoked_at
  from public.coach_athlete_links l
  left join public.coach_profiles cp on cp.user_id = l.coach_id
  where auth.uid() is not null
    and l.athlete_id = auth.uid()
    and l.status = 'revoked'
    and l.ended_by = 'coach'
    and l.ended_notice_seen_at is null
    and public.coach_link_notice_allowed(auth.uid())
    and l.created_at = (
      select max(l2.created_at)
      from public.coach_athlete_links l2
      where l2.athlete_id = auth.uid()
    )
  limit 1;
$$;

-- Marks the line seen. Returns true when this call marked it, false when it was
-- already seen or is not the caller's removal line. Raises v2_unavailable while
-- the gate is closed, and changes nothing.
create or replace function public.mark_link_notice_seen(p_link_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_link_id is null then
    raise exception 'missing link' using errcode = '22023';
  end if;
  if not public.coach_link_notice_allowed(v_uid) then
    raise exception 'v2_unavailable' using errcode = 'P0001';
  end if;

  update public.coach_athlete_links
  set ended_notice_seen_at = now()
  where id = p_link_id
    and athlete_id = v_uid
    and status = 'revoked'
    and ended_by = 'coach'
    and ended_notice_seen_at is null;

  return found;
end;
$$;

-- Function grants -----------------------------------------------------------------------

-- Internal only. Security-definer callers (owned by the migration role) keep them.
revoke all on function public.end_coach_link(uuid, text) from public, anon, authenticated;
revoke all on function public.coach_link_notice_allowed(uuid) from public, anon, authenticated;

revoke all on function public.leave_coach(uuid) from public, anon;
grant execute on function public.leave_coach(uuid) to authenticated;

revoke all on function public.coach_remove_athlete(uuid) from public, anon;
grant execute on function public.coach_remove_athlete(uuid) to authenticated;

revoke all on function public.my_coach_link_notice() from public, anon;
grant execute on function public.my_coach_link_notice() to authenticated;

revoke all on function public.mark_link_notice_seen(uuid) from public, anon;
grant execute on function public.mark_link_notice_seen(uuid) to authenticated;

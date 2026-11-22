-- Coach Experience v2, story C7.8: consent v2 and the one-time notice for
-- existing athletes. M5a, Batch A.
--
-- Do not apply this to production from the app PR. Nadav applies
-- 20261121110000_coach_consent_v2.sql himself, in Batch A, after
-- 20261121100000_coach_v2_gate.sql, the Grok Bot audit and the 1.2.6 regression.
-- Mirror it to the web repo Running-coach- at v0/supabase/migrations/. Do not
-- apply an older copy.
--
-- "Coach" here means a HUMAN coach (Coach Mode). It is unrelated to the AI coach
-- (coach_message, coaching_style).
--
-- Depends on Story 1.2 (coach_profiles, coach_invites), Story 1.3
-- (coach_athlete_links, join_coach) and C7.0 (client_capabilities,
-- runtime_flags, coach_v2_pilot_coaches, link_is_v2).
--
-- What this file adds:
--   coach_athlete_links.consent_version          1 = the MVP A3 copy, 2 = the v2
--                                                copy (P8 at join, or P9 later).
--   coach_athlete_links.consent_acknowledged_at  when the athlete accepted v2.
--                                                Set once, never moved.
--   join_coach(code, invite, coach, athlete)     same signature as Story 1.3, so
--                                                1.2.6 clients keep working. It
--                                                writes consent_version = 1, no ack.
--   join_coach_v2(..., p_consent_version)        the v2 client's join. Version 2
--                                                writes the ack in the same call
--                                                (C7.8 AC2).
--   coach_invite_consent_version(code)           before joining: 2 when the P8 copy
--                                                applies to this coach, else 1 (AC7).
--   ack_coach_consent(p_version)                 P9 OK. Link athlete only,
--                                                idempotent, keeps the first ack time.
--   coach_v2_sharing_allowed(coach, athlete)     internal gate for every later
--                                                sharing RPC (C7.3, C7.4, C7.7):
--                                                link_is_v2 AND consent v2 acked.
--                                                Not callable by clients.
--   my_coach_consent_status()                    the caller's own active link only:
--                                                coach name, link_is_v2,
--                                                needs_v2_ack, sharing_active.
--
-- Rule (decision D7): nothing is shared before the athlete accepts the v2 copy.
-- A link with consent_version < 2, or without consent_acknowledged_at, gets
-- nothing from coach_v2_sharing_allowed, whatever the clients report.
--
-- Idempotent: columns are add-if-not-exists, constraints are added only when
-- missing, functions are create or replace, grants are restated. Re-applying
-- never changes a link's consent values.
--
-- Rollback: supabase/rollback/20261121110000_coach_consent_v2.sql (drops the new
-- functions, restores Story 1.3's join_coach, keeps the columns and their values).
-- Runbook: docs/coach-v2-rollback.md.

-- Columns ----------------------------------------------------------------------

alter table public.coach_athlete_links
  add column if not exists consent_version integer not null default 1;

alter table public.coach_athlete_links
  add column if not exists consent_acknowledged_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'coach_athlete_links_consent_version_min'
      and conrelid = 'public.coach_athlete_links'::regclass
  ) then
    alter table public.coach_athlete_links
      add constraint coach_athlete_links_consent_version_min
      check (consent_version >= 1);
  end if;

  -- A v2 consent always records when it was given.
  if not exists (
    select 1 from pg_constraint
    where conname = 'coach_athlete_links_consent_ack_required'
      and conrelid = 'public.coach_athlete_links'::regclass
  ) then
    alter table public.coach_athlete_links
      add constraint coach_athlete_links_consent_ack_required
      check (consent_version < 2 or consent_acknowledged_at is not null);
  end if;
end $$;

-- Existing links keep the MVP consent (version 1, no ack). Report the counts.
do $$
declare
  v_v1 bigint;
  v_v2 bigint;
begin
  select count(*) filter (where consent_version < 2),
         count(*) filter (where consent_version >= 2)
    into v_v1, v_v2
  from public.coach_athlete_links
  where status = 'active';
  raise notice 'coach_consent_v2: active links on consent v1 = %, on consent v2 = %', v_v1, v_v2;
end $$;

-- Internal gate ------------------------------------------------------------------

-- True only when the pair is v2 (link_is_v2: kill switch on, active link, both
-- clients v2, allowlist rule) AND the athlete accepted the v2 copy. Every later
-- sharing RPC checks this. Not granted to clients, like link_is_v2.
create or replace function public.coach_v2_sharing_allowed(p_coach uuid, p_athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.link_is_v2(p_coach, p_athlete)
  and exists (
    select 1
    from public.coach_athlete_links l
    where l.coach_id = p_coach
      and l.athlete_id = p_athlete
      and l.status = 'active'
      and l.consent_version >= 2
      and l.consent_acknowledged_at is not null
  );
$$;

-- Join ---------------------------------------------------------------------------

-- Story 1.3's join, plus the consent version the athlete saw. p_consent_version 2
-- means the athlete accepted the P8 copy: the link is created with version 2 and
-- consent_acknowledged_at = now() in the same insert (C7.8 AC2). Version 1 is the
-- MVP A3 copy. The server stores what the athlete saw; sharing still waits for
-- coach_v2_sharing_allowed, so a version-2 link to a coach who is not v2 shares
-- nothing until the pair is v2, and then needs no P9.
create or replace function public.join_coach_v2(
  code text,
  expected_invite_id uuid,
  expected_coach_id uuid,
  expected_athlete_id uuid,
  p_consent_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite uuid;
  v_coach uuid;
  v_name text;
  v_active boolean;
  v_existing_coach uuid;
  v_existing_name text;
  v_link_id uuid;
  v_consented_at timestamptz;
  v_ack timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_consent_version is null or p_consent_version not in (1, 2) then
    raise exception 'bad_consent_version' using errcode = '22023';
  end if;

  if v_uid is distinct from expected_athlete_id then
    raise exception 'consenting athlete changed' using errcode = '42501';
  end if;

  select ci.id, ci.coach_id, cp.display_name, ci.active
    into v_invite, v_coach, v_name, v_active
  from public.coach_invites ci
  join public.coach_profiles cp on cp.user_id = ci.coach_id
  where upper(ci.code) = upper(btrim(join_coach_v2.code))
  limit 1
  for share of ci;

  if not found or v_active is not true then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;

  if v_invite is distinct from expected_invite_id
     or v_coach is distinct from expected_coach_id then
    raise exception 'consent_mismatch' using errcode = 'P0001';
  end if;

  if v_coach = v_uid then
    raise exception 'cannot_join_self' using errcode = 'P0001';
  end if;

  insert into public.coach_athlete_links
    (coach_id, athlete_id, status, consented_at, consent_version, consent_acknowledged_at)
  values
    (v_coach, v_uid, 'active', now(), p_consent_version,
     case when p_consent_version >= 2 then now() else null end)
  on conflict (athlete_id) where status = 'active' do nothing
  returning id, consented_at, consent_acknowledged_at into v_link_id, v_consented_at, v_ack;

  if found then
    return jsonb_build_object(
      'status', 'joined',
      'link_id', v_link_id,
      'consented_at', v_consented_at,
      'coach_id', v_coach,
      'display_name', v_name,
      'consent_version', p_consent_version,
      'consent_acknowledged_at', v_ack
    );
  end if;

  select l.coach_id, cp.display_name
    into v_existing_coach, v_existing_name
  from public.coach_athlete_links l
  join public.coach_profiles cp on cp.user_id = l.coach_id
  where l.athlete_id = v_uid
    and l.status = 'active';

  if not found then
    raise exception 'active link changed' using errcode = '40001';
  end if;

  return jsonb_build_object(
    'status', 'already_linked',
    'coach_id', v_existing_coach,
    'display_name', v_existing_name
  );
end;
$$;

-- Same signature and behavior as Story 1.3. 1.2.6 clients call this and saw the
-- A3 copy, so their joins stay at consent_version = 1 with no ack. The payload
-- gains two keys; the 1.2.6 decoder ignores unknown keys.
create or replace function public.join_coach(
  code text,
  expected_invite_id uuid,
  expected_coach_id uuid,
  expected_athlete_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.join_coach_v2(
    join_coach.code,
    join_coach.expected_invite_id,
    join_coach.expected_coach_id,
    join_coach.expected_athlete_id,
    1
  );
end;
$$;

-- Before joining, the athlete has no link, so link_is_v2 cannot answer. This
-- applies link_is_v2's rules 1, 3 and 4 to (invite's coach, caller) without rule 2
-- (the active link). Keep it in step with link_is_v2. Returns 2 when the P8 copy
-- applies, else 1 (C7.8 AC7: a coach who is not v2 gets the A3 copy). A missing or
-- inactive code returns 1; join_coach rejects it. A wrong answer is safe either
-- way: 1 shows A3 and then P9 once the link is v2; 2 stores what the athlete saw.
create or replace function public.coach_invite_consent_version(code text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is not null and exists (
    select 1
    from public.coach_invites ci
    join public.client_capabilities cc on cc.user_id = ci.coach_id
    join public.client_capabilities ca on ca.user_id = auth.uid()
    where ci.active
      and upper(ci.code) = upper(btrim(coach_invite_consent_version.code))
      and ci.coach_id <> auth.uid()
      and coalesce(
        (select f.enabled from public.runtime_flags f where f.key = 'coach_v2'),
        false
      )
      and cc.coach_v2
      and ca.coach_v2
      and (
        exists (select 1 from public.coach_v2_pilot_coaches p where p.coach_id = ci.coach_id)
        or (cc.channel <> 'app_store' and ca.channel <> 'app_store')
      )
  ) then 2 else 1 end;
$$;

-- Acknowledge ----------------------------------------------------------------------

-- P9 OK. Acts on the caller's own active link as the athlete, so a coach or any
-- other user gets no_active_link (C7.8 AC6). Version 2 is the only version.
-- Idempotent: a second call returns already_acked and keeps the first ack time.
-- A pair that is not v2 (kill switch, a client not on v2, unlisted App Store
-- coach) raises v2_unavailable, and P9 shows again on a later open.
create or replace function public.ack_coach_consent(p_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_link_id uuid;
  v_coach uuid;
  v_version integer;
  v_ack timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_version is distinct from 2 then
    raise exception 'bad_consent_version' using errcode = '22023';
  end if;

  select l.id, l.coach_id, l.consent_version, l.consent_acknowledged_at
    into v_link_id, v_coach, v_version, v_ack
  from public.coach_athlete_links l
  where l.athlete_id = v_uid
    and l.status = 'active'
  for update;

  if not found then
    raise exception 'no_active_link' using errcode = 'P0001';
  end if;

  if v_version >= p_version and v_ack is not null then
    return jsonb_build_object(
      'status', 'already_acked',
      'link_id', v_link_id,
      'consent_version', v_version,
      'consent_acknowledged_at', v_ack
    );
  end if;

  if not public.link_is_v2(v_coach, v_uid) then
    raise exception 'v2_unavailable' using errcode = 'P0001';
  end if;

  update public.coach_athlete_links
     set consent_version = greatest(consent_version, p_version),
         consent_acknowledged_at = coalesce(consent_acknowledged_at, now())
   where id = v_link_id
  returning consent_version, consent_acknowledged_at into v_version, v_ack;

  return jsonb_build_object(
    'status', 'acked',
    'link_id', v_link_id,
    'consent_version', v_version,
    'consent_acknowledged_at', v_ack
  );
end;
$$;

-- Status -----------------------------------------------------------------------------

-- The caller's own active link as the athlete, never anyone else's. Zero rows
-- without an active link.
--   link_is_v2      the pair is v2 now (the leave sheet adds its v2 lines).
--   needs_v2_ack    show P9: the pair is v2 and the athlete has not accepted v2.
--                   False while the kill switch is on.
--   sharing_active  the athlete accepted and the pair is v2: the app may sync
--                   effort and notes (C7.3).
create or replace function public.my_coach_consent_status()
returns table (
  link_id uuid,
  coach_display_name text,
  link_is_v2 boolean,
  needs_v2_ack boolean,
  sharing_active boolean
)
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

  return query
  select
    s.id,
    s.display_name,
    s.is_v2,
    s.is_v2 and not s.acked,
    s.is_v2 and s.acked
  from (
    select
      l.id,
      cp.display_name,
      public.link_is_v2(l.coach_id, l.athlete_id) as is_v2,
      (l.consent_version >= 2 and l.consent_acknowledged_at is not null) as acked
    from public.coach_athlete_links l
    join public.coach_profiles cp on cp.user_id = l.coach_id
    where l.athlete_id = v_uid
      and l.status = 'active'
  ) s;
end;
$$;

-- Function grants ----------------------------------------------------------------------

revoke all on function public.join_coach(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.join_coach(text, uuid, uuid, uuid) to authenticated;

revoke all on function public.join_coach_v2(text, uuid, uuid, uuid, integer) from public, anon;
grant execute on function public.join_coach_v2(text, uuid, uuid, uuid, integer) to authenticated;

revoke all on function public.coach_invite_consent_version(text) from public, anon;
grant execute on function public.coach_invite_consent_version(text) to authenticated;

revoke all on function public.ack_coach_consent(integer) from public, anon;
grant execute on function public.ack_coach_consent(integer) to authenticated;

revoke all on function public.my_coach_consent_status() from public, anon;
grant execute on function public.my_coach_consent_status() to authenticated;

-- Internal only. Security-definer callers (owned by the migration role) keep it.
revoke all on function public.coach_v2_sharing_allowed(uuid, uuid) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.coach_v2_sharing_allowed(uuid, uuid) to service_role;
  end if;
end $$;

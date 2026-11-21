-- Coach Experience v2, story C7.0 (with C7.12 folded in): the v2 gate.
-- M0 + M0b in one file, Batch A.
--
-- Do not apply this to production from the app PR. Nadav applies
-- 20261121100000_coach_v2_gate.sql himself, in Batch A, after the Grok Bot audit
-- and the 1.2.6 regression. Mirror it to the web repo Running-coach- at
-- v0/supabase/migrations/. Do not apply an older copy.
--
-- "Coach" here means a HUMAN coach (Coach Mode). It is unrelated to the AI coach
-- (coach_message, coaching_style).
--
-- Depends on Story 1.2 (coach_profiles), Story 1.3 (coach_athlete_links).
--
-- What this file creates:
--   client_capabilities       one row per user: is this client v2-capable, plus
--                             its version, build, platform and release channel.
--   report_client_capabilities(...)  the only write path for that row (own row).
--   runtime_flags             the server kill switch: coach_v2, coach_v2_push,
--                             coach_v2_ai. No client can read or write the table.
--   get_runtime_flags()       returns only the allow-listed keys.
--   coach_v2_pilot_coaches    decision N1 = B: the coaches whose links get v2 in
--                             App Store builds. Ships empty. Nadav adds rows.
--   coach_v2_pilot_access()   true when the caller is a listed coach or has an
--                             active link to one.
--   link_is_v2(coach, athlete)       the gate every later v2 RPC checks. Not
--                             callable by clients.
--   coach_v2_roster_status()  per active athlete of the caller: athlete_is_v2,
--                             so the roster can show "{Athlete} needs the latest
--                             RunSmart".
--
-- How link_is_v2 decides (all must hold):
--   1. runtime_flags.coach_v2 is enabled. A missing row counts as off.
--   2. The link (coach, athlete) is active.
--   3. Both users reported coach_v2 = true.
--   4. The coach is in coach_v2_pilot_coaches, OR neither side reported the
--      app_store channel (both are Debug or TestFlight).
-- Rule 4 is the server half of N1 = B. A client can send any value it likes, so
-- reported values are claims, not proof. The athlete's own claim is what guards
-- the athlete's data: an App Store athlete linked to an unlisted coach reports
-- coach_v2 = false, so a forged report from that coach turns nothing on. And when
-- either side is on the App Store build, only Nadav's allowlist can turn the pair
-- on, whatever the coach reports. The allowlist is read live, so removing a coach
-- takes effect on the next call, with no client report needed.
--
-- Idempotent: tables, indexes and seed rows are create/insert if not exists,
-- policies are dropped and recreated, functions are create or replace, grants
-- are restated. Re-applying never flips a flag Nadav set.
--
-- Rollback: supabase/rollback/20261121100000_coach_v2_gate.sql (drops the
-- functions, keeps the tables and their rows). Runbook: docs/coach-v2-rollback.md.

-- Tables -----------------------------------------------------------------------

create table if not exists public.client_capabilities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coach_v2 boolean not null default false,
  app_version text,
  build integer,
  platform text,
  channel text not null default 'app_store',
  updated_at timestamptz not null default now(),
  constraint client_capabilities_channel
    check (channel in ('debug', 'testflight', 'app_store')),
  constraint client_capabilities_version_length
    check (app_version is null or char_length(app_version) <= 32),
  constraint client_capabilities_build_range
    check (build is null or build >= 0),
  constraint client_capabilities_platform_length
    check (platform is null or char_length(platform) <= 16)
);

create table if not exists public.runtime_flags (
  key text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  note text
);

create table if not exists public.coach_v2_pilot_coaches (
  coach_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

-- Seed the flags on. A row Nadav already changed is never overwritten.
insert into public.runtime_flags (key, enabled, note) values
  ('coach_v2', true, 'Kill switch for every v2 coach feature. false = link_is_v2 is false for every pair.'),
  ('coach_v2_push', true, 'false = coach push senders send nothing and keep their queue.'),
  ('coach_v2_ai', true, 'false = coach AI drafting and weekly summaries pause.')
on conflict (key) do nothing;

-- RLS and table grants -----------------------------------------------------------

alter table public.client_capabilities enable row level security;
alter table public.runtime_flags enable row level security;
alter table public.coach_v2_pilot_coaches enable row level security;

revoke all on table public.client_capabilities from public, anon, authenticated;
revoke all on table public.runtime_flags from public, anon, authenticated;
revoke all on table public.coach_v2_pilot_coaches from public, anon, authenticated;

-- A user can read their own capability row. Writes go through the RPC only.
grant select on table public.client_capabilities to authenticated;

drop policy if exists client_capabilities_owner_select on public.client_capabilities;
create policy client_capabilities_owner_select on public.client_capabilities
  for select to authenticated
  using (user_id = (select auth.uid()));

-- runtime_flags and coach_v2_pilot_coaches have no client policy and no client
-- grant. Clients read them only through the functions below.

-- Functions --------------------------------------------------------------------

-- Own row only. p_channel says which build sent it: 'debug', 'testflight' or
-- 'app_store'. A missing channel is stored as 'app_store', the strictest case.
create or replace function public.report_client_capabilities(
  p_coach_v2 boolean,
  p_version text,
  p_build integer,
  p_channel text default 'app_store',
  p_platform text default 'ios'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel text := coalesce(p_channel, 'app_store');
  v_version text := nullif(btrim(coalesce(p_version, '')), '');
  v_platform text := nullif(btrim(coalesce(p_platform, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_channel not in ('debug', 'testflight', 'app_store') then
    raise exception 'bad_channel' using errcode = '22023';
  end if;
  if v_version is not null and char_length(v_version) > 32 then
    raise exception 'bad_version' using errcode = '22023';
  end if;
  if p_build is not null and p_build < 0 then
    raise exception 'bad_build' using errcode = '22023';
  end if;
  if v_platform is not null and char_length(v_platform) > 16 then
    raise exception 'bad_platform' using errcode = '22023';
  end if;

  insert into public.client_capabilities as c
    (user_id, coach_v2, app_version, build, platform, channel, updated_at)
  values
    (auth.uid(), coalesce(p_coach_v2, false), v_version, p_build, v_platform, v_channel, now())
  on conflict (user_id) do update
    set coach_v2 = excluded.coach_v2,
        app_version = excluded.app_version,
        build = excluded.build,
        platform = excluded.platform,
        channel = excluded.channel,
        updated_at = excluded.updated_at;
end;
$$;

-- Only the keys clients may see. A key added to runtime_flags later stays hidden
-- until a migration adds it here.
create or replace function public.get_runtime_flags()
returns table (key text, enabled boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select f.key, f.enabled
  from public.runtime_flags f
  where f.key in ('coach_v2', 'coach_v2_push', 'coach_v2_ai')
  order by f.key;
$$;

-- True when the caller is a listed pilot coach, or an athlete with an active
-- link to one. Says nothing about the kill switch: the client checks that
-- separately through get_runtime_flags().
create or replace function public.coach_v2_pilot_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.coach_v2_pilot_coaches p
      where p.coach_id = auth.uid()
    )
    or exists (
      select 1
      from public.coach_athlete_links l
      join public.coach_v2_pilot_coaches p on p.coach_id = l.coach_id
      where l.athlete_id = auth.uid()
        and l.status = 'active'
    )
  );
$$;

-- The v2 gate. See the header for the rules. Not granted to clients: any pair of
-- ids could otherwise be probed for whether they are linked. Later v2 RPCs are
-- security definer and call it with auth.uid() on one side.
create or replace function public.link_is_v2(p_coach uuid, p_athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select f.enabled from public.runtime_flags f where f.key = 'coach_v2'),
    false
  )
  and exists (
    select 1
    from public.coach_athlete_links l
    join public.client_capabilities cc on cc.user_id = l.coach_id
    join public.client_capabilities ca on ca.user_id = l.athlete_id
    where l.coach_id = p_coach
      and l.athlete_id = p_athlete
      and l.status = 'active'
      and cc.coach_v2
      and ca.coach_v2
      and (
        exists (select 1 from public.coach_v2_pilot_coaches p where p.coach_id = l.coach_id)
        or (cc.channel <> 'app_store' and ca.channel <> 'app_store')
      )
  );
$$;

-- Roster helper for the signed-in coach. athlete_is_v2 is the athlete's half of
-- link_is_v2: the athlete reported coach_v2 = true, and either the coach is
-- listed or the athlete is not on the App Store build. Zero rows while the kill
-- switch is off, like every v2 read.
create or replace function public.coach_v2_roster_status()
returns table (athlete_id uuid, athlete_is_v2 boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.athlete_id,
    coalesce(
      ca.coach_v2 and (
        exists (select 1 from public.coach_v2_pilot_coaches p where p.coach_id = l.coach_id)
        or ca.channel <> 'app_store'
      ),
      false
    ) as athlete_is_v2
  from public.coach_athlete_links l
  left join public.client_capabilities ca on ca.user_id = l.athlete_id
  where auth.uid() is not null
    and l.coach_id = auth.uid()
    and l.status = 'active'
    and coalesce(
      (select f.enabled from public.runtime_flags f where f.key = 'coach_v2'),
      false
    )
  order by l.athlete_id;
$$;

-- Function grants ----------------------------------------------------------------

revoke all on function public.report_client_capabilities(boolean, text, integer, text, text) from public, anon;
grant execute on function public.report_client_capabilities(boolean, text, integer, text, text) to authenticated;

revoke all on function public.get_runtime_flags() from public, anon;
grant execute on function public.get_runtime_flags() to authenticated;

revoke all on function public.coach_v2_pilot_access() from public, anon;
grant execute on function public.coach_v2_pilot_access() to authenticated;

revoke all on function public.coach_v2_roster_status() from public, anon;
grant execute on function public.coach_v2_roster_status() to authenticated;

-- Internal only. Security-definer callers (owned by the migration role) keep it.
revoke all on function public.link_is_v2(uuid, uuid) from public, anon, authenticated;

-- Edge Functions read the flags with the service role (supabase/functions/_shared/flags.ts).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.get_runtime_flags() to service_role;
    grant execute on function public.link_is_v2(uuid, uuid) to service_role;
  end if;
end $$;

-- Coach Experience v2, story C7.10: remote push foundation.
-- M2a, Batch B.
--
-- Do not apply this to production from the app PR. Nadav applies
-- 20261122100000_push_tokens_and_prefs.sql himself, in Batch B, together with the
-- APNs secrets and M2b. Mirror it to the web repo Running-coach- at
-- v0/supabase/migrations/. Do not apply an older copy.
--
-- "Coach" here means a HUMAN coach (Coach Mode). It is unrelated to the AI coach
-- (coach_message, coaching_style).
--
-- Depends on nothing but auth.users. It does not call link_is_v2: a token or a
-- prefs row shares nothing with anyone. The senders (C7.5, _shared/notify.ts)
-- apply the kill switch, the link check and the prefs at send time.
--
-- What this file creates:
--   push_tokens               one row per device (an APNs token is per device and
--                             app install). A user can read only their own rows.
--                             disabled_at is set by the sender on an APNs 410.
--   notification_prefs        one row per user, D6 defaults, the device time zone.
--                             A user can read only their own row.
--   register_push_token(p_token, p_env, p_bundle_id)   own row, per device.
--   unregister_push_token(p_token)   deletes this device's row only.
--   my_notification_prefs(p_time_zone)   the first read creates the row.
--   set_notification_time_zone(p_time_zone)   foreground time-zone update.
--   update_notification_prefs(...)   the write path for C7.14's settings screens.
--
-- No client insert, update or delete policy exists on either table. Every write is
-- one of the functions above, which act only on auth.uid()'s rows.
--
-- A token that comes back under another account (the device signed out offline,
-- so the old row was never deleted, then someone else signed in) moves to the new
-- account. Otherwise the device would keep getting the old account's pushes.
--
-- Idempotent: tables and indexes are create if not exists, policies are dropped
-- and recreated, functions are create or replace, grants are restated.
--
-- Rollback: supabase/rollback/20261122100000_push_tokens_and_prefs.sql (drops the
-- functions, keeps both tables and their rows). Runbook: docs/coach-v2-rollback.md.

-- Tables -----------------------------------------------------------------------

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  environment text not null,
  bundle_id text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  constraint push_tokens_token_key unique (token),
  constraint push_tokens_environment check (environment in ('sandbox', 'production')),
  constraint push_tokens_token_format check (token ~ '^[0-9a-f]{64,200}$'),
  constraint push_tokens_bundle_id_length
    check (bundle_id is null or char_length(bundle_id) between 1 and 155)
);

-- Senders read a user's live tokens.
create index if not exists push_tokens_user_live_idx
  on public.push_tokens (user_id)
  where disabled_at is null;

create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coach_run_finished boolean not null default true,
  coach_evening_summary boolean not null default true,
  coach_pain_flag boolean not null default true,
  athlete_coach_note boolean not null default true,
  athlete_plan_updates boolean not null default true,
  athlete_broadcasts boolean not null default true,
  quiet_start time not null default '21:30',
  quiet_end time not null default '07:00',
  time_zone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_prefs_quiet_hours_differ check (quiet_start <> quiet_end),
  constraint notification_prefs_time_zone_length check (char_length(time_zone) between 1 and 64)
);

-- RLS and table grants -----------------------------------------------------------

alter table public.push_tokens enable row level security;
alter table public.notification_prefs enable row level security;

revoke all on table public.push_tokens from public, anon, authenticated;
revoke all on table public.notification_prefs from public, anon, authenticated;

-- A user can read their own rows. Writes go through the functions only.
grant select on table public.push_tokens to authenticated;
grant select on table public.notification_prefs to authenticated;

drop policy if exists push_tokens_owner_select on public.push_tokens;
create policy push_tokens_owner_select on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notification_prefs_owner_select on public.notification_prefs;
create policy notification_prefs_owner_select on public.notification_prefs
  for select to authenticated
  using (user_id = (select auth.uid()));

-- The senders run as service_role: they read live tokens and prefs, and set
-- disabled_at on an APNs 410. service_role bypasses RLS; this grant only makes
-- the table access explicit on databases without Supabase's default privileges.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, update on table public.push_tokens to service_role;
    grant select on table public.notification_prefs to service_role;
  end if;
end $$;

-- Functions --------------------------------------------------------------------

-- Internal: a time zone Postgres knows (IANA names, as iOS sends them). Not
-- granted to clients.
create or replace function public.notification_time_zone_ok(p_time_zone text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_time_zone is not null
    and char_length(p_time_zone) between 1 and 64
    and exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone);
$$;

-- Own device only. p_env is 'sandbox' (Debug builds) or 'production' (TestFlight
-- and App Store). Registering again refreshes last_seen_at and clears disabled_at.
create or replace function public.register_push_token(
  p_token text,
  p_env text,
  p_bundle_id text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := lower(btrim(coalesce(p_token, '')));
  v_env text := btrim(coalesce(p_env, ''));
  v_bundle text := nullif(btrim(coalesce(p_bundle_id, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_token !~ '^[0-9a-f]{64,200}$' then
    raise exception 'bad_token' using errcode = '22023';
  end if;
  if v_env not in ('sandbox', 'production') then
    raise exception 'bad_environment' using errcode = '22023';
  end if;
  if v_bundle is not null and char_length(v_bundle) > 155 then
    raise exception 'bad_bundle_id' using errcode = '22023';
  end if;

  insert into public.push_tokens as t
    (user_id, token, environment, bundle_id, created_at, last_seen_at, disabled_at)
  values
    (auth.uid(), v_token, v_env, v_bundle, now(), now(), null)
  on conflict (token) do update
    set user_id = excluded.user_id,
        environment = excluded.environment,
        bundle_id = excluded.bundle_id,
        created_at = case when t.user_id = excluded.user_id then t.created_at else now() end,
        last_seen_at = now(),
        disabled_at = null;

  return 'registered';
end;
$$;

-- Deletes this device's token for the caller. Another user's token, or one that
-- is already gone, returns 'missing' and changes nothing.
create or replace function public.unregister_push_token(p_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := lower(btrim(coalesce(p_token, '')));
  v_deleted integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  delete from public.push_tokens
  where token = v_token
    and user_id = auth.uid();
  get diagnostics v_deleted = row_count;

  return case when v_deleted > 0 then 'removed' else 'missing' end;
end;
$$;

-- C7.10 AC9: the first read creates the caller's row with the D6 defaults and the
-- device time zone. A later read returns the row as it is; the time zone changes
-- only through set_notification_time_zone. A zone Postgres does not know is stored
-- as UTC, so the read never fails on a new zone name.
create or replace function public.my_notification_prefs(p_time_zone text)
returns public.notification_prefs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.notification_prefs;
  v_zone text := btrim(coalesce(p_time_zone, ''));
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.notification_time_zone_ok(v_zone) then
    v_zone := 'UTC';
  end if;

  insert into public.notification_prefs (user_id, time_zone)
  values (auth.uid(), v_zone)
  on conflict (user_id) do nothing;

  select * into v_row
  from public.notification_prefs
  where user_id = auth.uid();

  return v_row;
end;
$$;

-- Foreground: the device's time zone changed. Creates the row with the D6
-- defaults if the first read never happened.
create or replace function public.set_notification_time_zone(p_time_zone text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_zone text := btrim(coalesce(p_time_zone, ''));
  v_old text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.notification_time_zone_ok(v_zone) then
    raise exception 'bad_time_zone' using errcode = '22023';
  end if;

  select time_zone into v_old
  from public.notification_prefs
  where user_id = auth.uid()
  for update;

  if not found then
    insert into public.notification_prefs (user_id, time_zone)
    values (auth.uid(), v_zone)
    on conflict (user_id) do update
      set time_zone = excluded.time_zone, updated_at = now();
    return 'saved';
  end if;

  if v_old = v_zone then
    return 'unchanged';
  end if;

  update public.notification_prefs
     set time_zone = v_zone, updated_at = now()
   where user_id = auth.uid();
  return 'saved';
end;
$$;

-- C7.14's settings screens. A null argument keeps the stored value. The row must
-- exist (my_notification_prefs creates it). Quiet hours need different start and
-- end times.
create or replace function public.update_notification_prefs(
  p_coach_run_finished boolean default null,
  p_coach_evening_summary boolean default null,
  p_coach_pain_flag boolean default null,
  p_athlete_coach_note boolean default null,
  p_athlete_plan_updates boolean default null,
  p_athlete_broadcasts boolean default null,
  p_quiet_start time default null,
  p_quiet_end time default null
)
returns public.notification_prefs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.notification_prefs;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_row
  from public.notification_prefs
  where user_id = auth.uid()
  for update;

  if not found then
    raise exception 'prefs_missing' using errcode = 'P0002';
  end if;

  if coalesce(p_quiet_start, v_row.quiet_start) = coalesce(p_quiet_end, v_row.quiet_end) then
    raise exception 'bad_quiet_hours' using errcode = '22023';
  end if;

  update public.notification_prefs
     set coach_run_finished = coalesce(p_coach_run_finished, coach_run_finished),
         coach_evening_summary = coalesce(p_coach_evening_summary, coach_evening_summary),
         coach_pain_flag = coalesce(p_coach_pain_flag, coach_pain_flag),
         athlete_coach_note = coalesce(p_athlete_coach_note, athlete_coach_note),
         athlete_plan_updates = coalesce(p_athlete_plan_updates, athlete_plan_updates),
         athlete_broadcasts = coalesce(p_athlete_broadcasts, athlete_broadcasts),
         quiet_start = coalesce(p_quiet_start, quiet_start),
         quiet_end = coalesce(p_quiet_end, quiet_end),
         updated_at = now()
   where user_id = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;

-- Function grants ------------------------------------------------------------------

revoke all on function public.notification_time_zone_ok(text) from public, anon, authenticated;

revoke all on function public.register_push_token(text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;

revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

revoke all on function public.my_notification_prefs(text) from public, anon;
grant execute on function public.my_notification_prefs(text) to authenticated;

revoke all on function public.set_notification_time_zone(text) from public, anon;
grant execute on function public.set_notification_time_zone(text) to authenticated;

revoke all on function public.update_notification_prefs(boolean, boolean, boolean, boolean, boolean, boolean, time, time)
  from public, anon;
grant execute on function public.update_notification_prefs(boolean, boolean, boolean, boolean, boolean, boolean, time, time)
  to authenticated;

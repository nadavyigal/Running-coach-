-- Coach Mode, Story 1.2: coach role and invite code.
--
-- Creates exactly two tables, coach_profiles and coach_invites, plus the
-- get_or_create_my_invite() RPC. "Coach" here means a HUMAN coach. It is
-- unrelated to the AI coach (coach_message edge function, profiles.coaching_style,
-- the earlier tighten_coach_rls_policies migration).
--
-- Web repo (Running-coach-): this same file must be copied to
-- v0/supabase/migrations/ so both migration trees stay in step.
--
-- HOW TO FLAG A COACH (run in the SQL editor as postgres; clients cannot do this):
--
--   insert into coach_profiles (user_id, display_name)
--   values ('<auth.users uuid of the coach>', 'Dana');
--
-- To unflag: delete from coach_profiles where user_id = '<uuid>';
-- (their invites are removed with it, on delete cascade).
--
-- Idempotent: every statement is create-if-not-exists, create-or-replace, or
-- drop-if-exists AFTER its table exists (drop policy if exists on a missing
-- table errors in production, so tables come first).
--
-- Owner key: auth.users.id (the same value as profiles.auth_user_id), never the
-- legacy bigint profiles.id.

-- Tables ---------------------------------------------------------------------

create table if not exists public.coach_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_invites (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(user_id) on delete cascade,
  code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Codes are unique regardless of case; a coach has at most one active invite.
create unique index if not exists coach_invites_code_upper_key
  on public.coach_invites (upper(code));
create unique index if not exists coach_invites_one_active_per_coach
  on public.coach_invites (coach_id) where active;

-- Row level security: owner-read only, no client writes -------------------------

alter table public.coach_profiles enable row level security;
alter table public.coach_invites enable row level security;

-- Defense in depth: besides having no write policy, the API roles get no write
-- privilege at all. Writes happen through SQL (Nadav) or the security-definer RPC.
revoke all on table public.coach_profiles from anon, authenticated;
revoke all on table public.coach_invites from anon, authenticated;
grant select on table public.coach_profiles to authenticated;
grant select on table public.coach_invites to authenticated;

drop policy if exists coach_profiles_select_own on public.coach_profiles;
create policy coach_profiles_select_own on public.coach_profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists coach_invites_select_own on public.coach_invites;
create policy coach_invites_select_own on public.coach_invites
  for select to authenticated
  using (coach_id = (select auth.uid()));

-- RPC ------------------------------------------------------------------------

-- Returns the caller's active invite code, creating one if they have none.
-- Raises 'not a coach' (SQLSTATE 42501) for anyone without a coach_profiles row,
-- including signed-out callers.
create or replace function public.get_or_create_my_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- 31 characters, no 0/O/1/I/L.
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_uid uuid := auth.uid();
  v_code text;
  v_bytes bytea;
  v_attempt int := 0;
  v_i int;
begin
  if v_uid is null
     or not exists (select 1 from public.coach_profiles where user_id = v_uid) then
    raise exception 'not a coach' using errcode = '42501';
  end if;

  loop
    select ci.code into v_code
    from public.coach_invites ci
    where ci.coach_id = v_uid and ci.active;
    if found then
      return v_code;
    end if;

    v_attempt := v_attempt + 1;
    if v_attempt > 20 then
      raise exception 'could not generate an invite code';
    end if;

    -- Random bytes from a v4 uuid (CSPRNG-backed); the first six bytes carry no
    -- version bits. Modulo bias over 31 symbols is negligible for a short code.
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_code := '';
    for v_i in 0..5 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_i) % length(v_alphabet)) + 1, 1);
    end loop;

    begin
      insert into public.coach_invites (coach_id, code) values (v_uid, v_code);
      return v_code;
    exception when unique_violation then
      -- Either the code collided (retry with a new one) or a concurrent call just
      -- created this coach's active invite (the select above returns it next loop).
      null;
    end;
  end loop;
end;
$$;

revoke all on function public.get_or_create_my_invite() from public, anon;
grant execute on function public.get_or_create_my_invite() to authenticated;

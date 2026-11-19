-- Coach Mode, Story 1.7: Plan Mode and Group Plan Settings.
--
-- Adds one column on coach_profiles:
--   plan_mode text  null until chosen, then 'group' or 'individual'. Locked after that.
-- Creates coach_group_plans (one row per Group Plan coach) and the RPCs
-- set_plan_mode(mode) and save_group_plan_settings(...). Replaces
-- get_or_create_my_invite() so the invite code stays hidden until Plan Mode
-- is set and, for a Group Plan, settings are saved.
--
-- Web repo (Running-coach-): copy this file to v0/supabase/migrations/ so both
-- migration trees stay in step. Do not apply it to production from this PR.
-- Nadav applies it after review.
--
-- Generator values stored here are the raw strings Build my plan sends
-- (TrainingGoalRequest.webPlanGoal, targetDistanceSlug, supabaseExperience,
-- weeklyRunDays 2...7). They are not the on-screen goal titles.
--   goal:            habit | speed | distance
--   target_distance: 5k | 10k | half-marathon | marathon
--   level:           beginner | intermediate | advanced
--   runs_per_week:   2 through 7
--
-- Minimum weeks before a race are placeholders, the same numbers as
-- GroupPlanRules.minWeeksBeforeRace (5k 4, 10k 6, half-marathon 8, marathon 12).
-- The plan generator has no per-distance minimum; it only caps length at 16 weeks.
-- A race further out than 16 weeks is allowed. Nadav/PM to confirm the minimums.
--
-- Depends on Story 1.2 (coach_profiles, get_or_create_my_invite).
-- Idempotent: add column if not exists, create table if not exists,
-- policies dropped only after the table exists, functions create or replace.
--
-- Owner key: auth.users.id. "Coach" here is a human coach, not the AI coach.

-- coach_profiles.plan_mode ---------------------------------------------------

alter table public.coach_profiles
  add column if not exists plan_mode text
  check (plan_mode in ('group', 'individual'));

-- coach_group_plans ----------------------------------------------------------

create table if not exists public.coach_group_plans (
  coach_id uuid primary key references public.coach_profiles(user_id) on delete cascade,
  goal text not null,
  target_distance text not null,
  race_date date not null,
  level text not null,
  runs_per_week int not null,
  updated_at timestamptz default now(),
  constraint coach_group_plans_goal_check
    check (goal in ('habit', 'speed', 'distance')),
  constraint coach_group_plans_target_distance_check
    check (target_distance in ('5k', '10k', 'half-marathon', 'marathon')),
  constraint coach_group_plans_level_check
    check (level in ('beginner', 'intermediate', 'advanced')),
  constraint coach_group_plans_runs_per_week_check
    check (runs_per_week between 2 and 7)
);

alter table public.coach_group_plans enable row level security;

revoke all on table public.coach_group_plans from anon, authenticated;
grant select on table public.coach_group_plans to authenticated;

drop policy if exists coach_group_plans_select_own on public.coach_group_plans;
create policy coach_group_plans_select_own on public.coach_group_plans
  for select to authenticated
  using (coach_id = (select auth.uid()));

-- RPCs -----------------------------------------------------------------------

create or replace function public.set_plan_mode(mode text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null
     or not exists (select 1 from public.coach_profiles where user_id = v_uid) then
    raise exception 'not a coach' using errcode = '42501';
  end if;

  if mode is null or mode not in ('group', 'individual') then
    raise exception 'invalid_plan_mode' using errcode = '23514';
  end if;

  update public.coach_profiles
  set plan_mode = mode
  where user_id = v_uid
    and plan_mode is null;

  if not found then
    raise exception 'plan_mode_locked' using errcode = 'P0001';
  end if;

  return mode;
end;
$$;

create or replace function public.save_group_plan_settings(
  goal text,
  target_distance text,
  race_date date,
  level text,
  runs_per_week int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_mode text;
  v_days int;
  v_weeks int;
  v_min int;
begin
  if v_uid is null
     or not exists (select 1 from public.coach_profiles where user_id = v_uid) then
    raise exception 'not a coach' using errcode = '42501';
  end if;

  select cp.plan_mode into v_mode
  from public.coach_profiles cp
  where cp.user_id = v_uid;

  if v_mode is distinct from 'group' then
    raise exception 'plan_mode_not_group' using errcode = '42501';
  end if;

  if goal is null or goal not in ('habit', 'speed', 'distance')
     or target_distance is null or target_distance not in ('5k', '10k', 'half-marathon', 'marathon')
     or level is null or level not in ('beginner', 'intermediate', 'advanced')
     or runs_per_week is null or runs_per_week < 2 or runs_per_week > 7
     or race_date is null then
    raise exception 'invalid_group_plan' using errcode = '23514';
  end if;

  v_days := race_date - current_date;
  if v_days < 0 then
    raise exception 'race_date_in_past' using errcode = '22007';
  end if;

  -- Placeholders. Keep in step with GroupPlanRules.minWeeksBeforeRace.
  v_min := case target_distance
    when '5k' then 4
    when '10k' then 6
    when 'half-marathon' then 8
    when 'marathon' then 12
    else null
  end;

  v_weeks := ceil(v_days / 7.0)::int;
  if v_weeks < v_min then
    raise exception 'race_too_close' using errcode = '22007';
  end if;

  insert into public.coach_group_plans as g (
    coach_id, goal, target_distance, race_date, level, runs_per_week, updated_at
  ) values (
    v_uid, goal, target_distance, race_date, level, runs_per_week, now()
  )
  on conflict (coach_id) do update set
    goal = excluded.goal,
    target_distance = excluded.target_distance,
    race_date = excluded.race_date,
    level = excluded.level,
    runs_per_week = excluded.runs_per_week,
    updated_at = now();
end;
$$;

-- Same signature as Story 1.2. Invite stays unavailable until the gate is open.
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
  v_mode text;
  v_code text;
  v_bytes bytea;
  v_attempt int := 0;
  v_i int;
begin
  if v_uid is null
     or not exists (select 1 from public.coach_profiles where user_id = v_uid) then
    raise exception 'not a coach' using errcode = '42501';
  end if;

  select cp.plan_mode into v_mode
  from public.coach_profiles cp
  where cp.user_id = v_uid;

  if v_mode is null then
    raise exception 'plan_mode_not_set' using errcode = 'P0001';
  end if;

  if v_mode = 'group' and not exists (
    select 1 from public.coach_group_plans g where g.coach_id = v_uid
  ) then
    raise exception 'plan_mode_not_set' using errcode = 'P0001';
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

    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_code := '';
    for v_i in 0..5 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_i) % length(v_alphabet)) + 1, 1);
    end loop;

    begin
      insert into public.coach_invites (coach_id, code) values (v_uid, v_code);
      return v_code;
    exception when unique_violation then
      null;
    end;
  end loop;
end;
$$;

revoke all on function public.set_plan_mode(text) from public, anon;
revoke all on function public.save_group_plan_settings(text, text, date, text, int) from public, anon;
revoke all on function public.get_or_create_my_invite() from public, anon;

grant execute on function public.set_plan_mode(text) to authenticated;
grant execute on function public.save_group_plan_settings(text, text, date, text, int) to authenticated;
grant execute on function public.get_or_create_my_invite() to authenticated;

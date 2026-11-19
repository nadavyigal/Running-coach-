-- Coach Mode, Story 1.8: lookup_invite also returns Plan Mode and, for a
-- Group Plan coach, the group settings. join_coach is unchanged.
--
-- Argument signature stays lookup_invite(text). Postgres cannot replace a
-- function when the OUT row changes, so this drops the Story 1.3 function
-- first and creates it again. Existing columns (invite_id, coach_id,
-- display_name) stay. New columns are null for an Individual Plans coach.
--
-- Web repo (Running-coach-): copy this file to v0/supabase/migrations/ so both
-- migration trees stay in step. Do not apply it to production from this PR.
-- Nadav applies it after review.
--
-- Depends on Story 1.3 (lookup_invite) and Story 1.7 (plan_mode, coach_group_plans).
-- Idempotent: drop if exists, then create or replace, then re-grant.
--
-- Owner key: auth.users.id. "Coach" here is a human coach, not the AI coach.

drop function if exists public.lookup_invite(text);

create or replace function public.lookup_invite(code text)
returns table (
  invite_id uuid,
  coach_id uuid,
  display_name text,
  plan_mode text,
  goal text,
  target_distance text,
  race_date date,
  level text,
  runs_per_week integer
)
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

  return query
  select
    ci.id,
    cp.user_id,
    cp.display_name,
    cp.plan_mode,
    gp.goal,
    gp.target_distance,
    gp.race_date,
    gp.level,
    gp.runs_per_week
  from public.coach_invites ci
  join public.coach_profiles cp on cp.user_id = ci.coach_id
  left join public.coach_group_plans gp
    on gp.coach_id = cp.user_id
   and cp.plan_mode = 'group'
  where ci.active
    and upper(ci.code) = upper(btrim(lookup_invite.code));
end;
$$;

revoke all on function public.lookup_invite(text) from public, anon;
grant execute on function public.lookup_invite(text) to authenticated;

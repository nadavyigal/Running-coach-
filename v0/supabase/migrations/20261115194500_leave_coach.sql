-- Coach Mode, Story 1.5: an athlete leaves their human coach.
--
-- Adds leave_coach(expected_link_id) and tightens the coach SELECT policy on
-- coach_athlete_links so a revoked athlete disappears from coach queries.
-- The athlete still reads their own rows in every status.
--
-- Also adds purge_coach_data_for_deleted_account(uuid), which the
-- delete_account Edge Function calls. That Edge Function remains the only
-- account-deletion entry point. This function does not delete the auth user.
--
-- Flagged for the web repo's migration tree. Do not apply this to production
-- from the app PR. Nadav applies it after review.
--
-- Idempotent: policies are dropped and recreated, functions are
-- create-or-replace, grants are restated.
--
-- "Coach" here means a HUMAN coach. Unrelated to the AI coach.

-- Policies -------------------------------------------------------------------

alter table public.coach_athlete_links enable row level security;

revoke all on table public.coach_athlete_links from anon, authenticated;
grant select on table public.coach_athlete_links to authenticated;

drop policy if exists coach_athlete_links_select_own on public.coach_athlete_links;
drop policy if exists coach_athlete_links_select_athlete on public.coach_athlete_links;
drop policy if exists coach_athlete_links_select_coach_active on public.coach_athlete_links;

-- The athlete reads every status, including revoked history.
create policy coach_athlete_links_select_athlete on public.coach_athlete_links
  for select to authenticated
  using (athlete_id = (select auth.uid()));

-- A coach reads only active links. Revoked athletes vanish from coach queries.
create policy coach_athlete_links_select_coach_active on public.coach_athlete_links
  for select to authenticated
  using (
    coach_id = (select auth.uid())
    and status = 'active'
  );

-- No insert, update, or delete policy. The only revoke path is leave_coach().

-- leave_coach ----------------------------------------------------------------

drop function if exists public.leave_coach();
create or replace function public.leave_coach(expected_link_id uuid)
returns void
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

  update public.coach_athlete_links
  set status = 'revoked',
      revoked_at = now()
  where athlete_id = v_uid
    and id = expected_link_id
    and status = 'active'
  returning coach_id into v_coach;

  if not found then
    raise exception 'not_linked' using errcode = 'P0001';
  end if;

  -- STORY 4.2 HOOK: also delete this athlete's public.coach_plan_drafts rows
  -- for v_coach (the coach returned above). The table does not exist yet, so
  -- this function must not query it. Story 4.2 adds that delete here.
end;
$$;

revoke all on function public.leave_coach(uuid) from public, anon;
grant execute on function public.leave_coach(uuid) to authenticated;

-- Account-deletion cleanup, called by supabase/functions/delete_account ------

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
end;
$$;

revoke all on function public.purge_coach_data_for_deleted_account(uuid) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.purge_coach_data_for_deleted_account(uuid) to service_role;
  end if;
end $$;

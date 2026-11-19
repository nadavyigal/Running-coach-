-- Coach Mode, Story 3.3: the athlete's app shows "Coached by {Coach}" and the coach's
-- plan title on Today and the Plan.
--
-- Do not apply this to production from the app PR. Nadav applies
-- 20261118160000_get_my_coach.sql after review. Mirror it to the web repo
-- Running-coach- at v0/supabase/migrations/. Do not apply an older copy.
--
-- Depends on Story 1.2 (coach_profiles), Story 1.3 (coach_athlete_links) and
-- Story 1.7 (coach_profiles.plan_mode).
--
-- Why: my_coach_link() returns the link and the coach's name but not the coach's
-- Plan Mode, and the athlete can't read coach_profiles. get_my_coach() returns only
-- the caller's ACTIVE coach: coach_id, display_name and plan_mode ('group',
-- 'individual', or null while the coach hasn't chosen). A revoked link, or no link,
-- returns no row. No table or policy changes.
--
-- Idempotent: create or replace, then revoke and grant.

create or replace function public.get_my_coach()
returns table (coach_id uuid, display_name text, plan_mode text)
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
  select
    l.coach_id,
    coalesce(nullif(btrim(cp.display_name), ''), 'Coach'),
    cp.plan_mode
  from public.coach_athlete_links l
  join public.coach_profiles cp on cp.user_id = l.coach_id
  where l.athlete_id = auth.uid()
    and l.status = 'active'
  limit 1;
end;
$$;

revoke all on function public.get_my_coach() from public, anon;
grant execute on function public.get_my_coach() to authenticated;

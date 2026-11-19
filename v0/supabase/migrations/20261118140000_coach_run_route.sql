-- Coach Mode, Story 6.2: a coach reads the map of a linked athlete's run.
--
-- Do not apply this to production from the app PR. Nadav applies
-- 20261118140000_coach_run_route.sql after review. Mirror it to the web repo
-- Running-coach- at v0/supabase/migrations/. Do not apply an older copy.
--
-- Depends on Story 2.2 (is_active_coach_of) and Story 6.1 (runs.route_status, runs.route).
--
-- No new table and no RLS change: runs stays owner-only. A coach reaches a route only
-- through coach_get_run_route(), which checks an active link the same way as Story 2.2
-- and returns no row for a revoked or missing link, another coach, or an unknown run.
--
-- The four states, and only `map` carries the route:
--   map           route_status = 'shared' and route is not null
--   hidden        route_status = 'hidden_by_athlete' (Story 6.3)
--   route_hidden  route_status = 'too_short' (Story 6.4)
--   no_map        anything else: no route, sharing was off, or a route that arrived another
--                 way (web sync) with no route_status. A coach can't tell sharing was off.
-- There is no "syncing" state: telling the coach an upload is pending would reveal the
-- athlete's sharing setting.
--
-- runs.id is bigint (2026-11-14 live check), so p_run is bigint.
--
-- Idempotent: create or replace, then revoke and grant.

create or replace function public.coach_get_run_route(p_run bigint)
returns table (state text, route jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_athlete uuid;
  v_status text;
  v_route jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select r.auth_user_id, r.route_status, r.route
  into v_athlete, v_status, v_route
  from public.runs r
  where r.id = p_run;

  if not found or v_athlete is null or not public.is_active_coach_of(v_athlete) then
    return;
  end if;

  if v_status = 'shared' and v_route is not null then
    return query select 'map'::text, v_route;
  elsif v_status = 'hidden_by_athlete' then
    return query select 'hidden'::text, null::jsonb;
  elsif v_status = 'too_short' then
    return query select 'route_hidden'::text, null::jsonb;
  else
    return query select 'no_map'::text, null::jsonb;
  end if;
end;
$$;

revoke all on function public.coach_get_run_route(bigint) from public, anon;
grant execute on function public.coach_get_run_route(bigint) to authenticated;

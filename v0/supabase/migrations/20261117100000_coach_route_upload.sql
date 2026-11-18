-- Story 6.1. Mirror to the web migration tree at rollout. No production apply.
-- Existing web/share routes retain NULL status. Story 6.2 must check this marker
-- as well as the active coach link before it returns a route.
alter table public.runs add column if not exists route_status text
  check (route_status in ('shared','hidden_by_athlete','too_short'));

create or replace function public.save_coach_run_route(
  expected_owner_id uuid, expected_link_id uuid, recorded_run_id uuid, prepared_route jsonb
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  athlete uuid := auth.uid();
  consent_time timestamptz;
begin
  if athlete is null or athlete is distinct from expected_owner_id then return 'stopped'; end if;

  -- Serialize the consent check against Leave Coach. No data is returned.
  select l.consented_at into consent_time
    from public.coach_athlete_links l
    where l.id = expected_link_id and l.athlete_id = athlete and l.status = 'active'
    for share;
  if not found then return 'stopped'; end if;

  if jsonb_typeof(prepared_route) is distinct from 'array' then return 'stopped'; end if;
  if jsonb_array_length(prepared_route) not between 2 and 512
    or pg_column_size(prepared_route) > 32768 then return 'stopped'; end if;
  if exists (
    select 1 from jsonb_array_elements(prepared_route) p
    where case
      when jsonb_typeof(p) = 'object'
        and jsonb_typeof(p->'lat') = 'number' and jsonb_typeof(p->'lng') = 'number'
      then (p - 'lat' - 'lng') <> '{}'::jsonb
        or abs((p->>'lat')::numeric) > 90 or abs((p->>'lng')::numeric) > 180
      else true
    end
  ) then return 'stopped'; end if;

  update public.runs r set route = prepared_route, route_status = 'shared'
    where r.auth_user_id = athlete and r.source_provider = 'runsmart_ios'
      and r.source_activity_id in (recorded_run_id::text, upper(recorded_run_id::text)) and r.completed_at > consent_time
      and (r.route_status is null or r.route_status = 'shared');
  if found then return 'saved'; end if;
  if exists (
    select 1 from public.runs r
    where r.auth_user_id = athlete and r.source_provider = 'runsmart_ios'
      and r.source_activity_id in (recorded_run_id::text, upper(recorded_run_id::text))
  ) then return 'stopped'; end if;
  return 'missing';
end;
$$;

revoke all on function public.save_coach_run_route(uuid, uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_coach_run_route(uuid, uuid, uuid, jsonb) to authenticated;

-- Story 6.3. Mirror to Running-coach-/v0/supabase/migrations/ at rollout.
-- Nadav applies after review. Only change visibility; preserve the uploaded route.
create or replace function public.set_run_route_hidden(p_run bigint, p_hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target public.runs%rowtype;
  desired text := case when p_hidden then 'hidden_by_athlete' else 'shared' end;
begin
  if p_hidden is null then
    raise exception 'Specify whether the map should be hidden' using errcode = '22004';
  end if;
  select * into target from public.runs
    where id = p_run and auth_user_id = auth.uid() for update;
  if not found then
    raise exception 'Run unavailable to this athlete' using errcode = '42501';
  end if;
  if target.route_status is null or target.route_status not in ('shared','hidden_by_athlete')
     or jsonb_typeof(target.route) is distinct from 'array' then
    raise exception 'Run has no uploaded coach route' using errcode = '22023';
  end if;
  if jsonb_array_length(target.route) < 2 then
    raise exception 'Run has no uploaded coach route' using errcode = '22023';
  end if;
  if target.route_status <> desired then
    update public.runs set route_status = desired where id = p_run;
  end if;
end $$;

revoke all on function public.set_run_route_hidden(bigint, boolean) from public, anon;
grant execute on function public.set_run_route_hidden(bigint, boolean) to authenticated;

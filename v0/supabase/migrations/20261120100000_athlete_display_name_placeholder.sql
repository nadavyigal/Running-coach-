-- Builds before 1.2.7 saved 'RunSmart Runner' when a runner gave no name, so every unnamed
-- athlete showed the same name in the coach list. Treat that placeholder like a blank name.
-- Same signature, owner rights and grants as 20261117164500_coach_read_rpcs.sql.
create or replace function public.athlete_display_name(p_athlete uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select btrim(p.name) as name
    from public.profiles p
    where p.auth_user_id = p_athlete
    order by p.updated_at desc nulls last
    limit 1
  )
  select coalesce(
    (select name from latest where name <> '' and lower(name) <> 'runsmart runner'),
    'Athlete'
  );
$$;

revoke all on function public.athlete_display_name(uuid) from public, anon, authenticated;

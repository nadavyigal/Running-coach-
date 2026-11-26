-- Coach display name (2026-11-26, names fix).
--
-- Athletes see coach_profiles.display_name in My coach, coach notes and pushes. Until now
-- only an admin could set it (by hand, at coach setup), and a blank name read as
-- "Your coach" / "Coach". This adds one RPC so the coach sets and edits their own name.
--
-- Depends on Story 1.2 (coach_profiles). No new tables, columns or client write grants:
-- coaches still cannot update coach_profiles directly. The function only touches the
-- caller's own row.
--
-- Rules (the iOS app checks the same, in CoachDisplayName.swift):
--   - surrounding white space is trimmed;
--   - blank, or a placeholder the app shows when there is no name ('coach', 'your coach',
--     'athlete', 'runsmart runner', any case), is rejected: 22023 name_required;
--   - more than 40 characters (char_length, code points) is rejected: 22023 name_too_long;
--   - a caller without a coach_profiles row is rejected: 42501 not_coach.
-- Returns the stored name.

create or replace function public.set_coach_display_name(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(coalesce(p_name, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  if not exists (select 1 from public.coach_profiles where user_id = auth.uid()) then
    raise exception 'not_coach' using errcode = '42501';
  end if;
  if v_name = '' or lower(v_name) in ('coach', 'your coach', 'athlete', 'runsmart runner') then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if char_length(v_name) > 40 then
    raise exception 'name_too_long' using errcode = '22023';
  end if;

  update public.coach_profiles
  set display_name = v_name
  where user_id = auth.uid();

  return v_name;
end;
$$;

revoke all on function public.set_coach_display_name(text) from public, anon;
grant execute on function public.set_coach_display_name(text) to authenticated;

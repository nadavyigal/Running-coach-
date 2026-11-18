-- Coach Mode, Story 3.4. Do not apply this migration from the app PR.
-- After founder review, mirror it to Running-coach-/v0/supabase/migrations/.
-- No new tables or client write grants.

alter table public.coach_profiles add column if not exists welcome_template text;
alter table public.coach_athlete_links add column if not exists welcome_claimed_at timestamptz;
alter table public.coach_feedback
  add column if not exists kind text not null default 'note' check (kind in ('note', 'welcome'));

alter table public.coach_feedback
  drop constraint if exists coach_feedback_one_target,
  drop constraint if exists coach_feedback_text_length;

alter table public.coach_feedback
  add constraint coach_feedback_one_target check (
    (kind = 'note' and ((run_id is null) <> (week_start is null)))
    or (kind = 'welcome' and run_id is null and week_start is null)
  ),
  -- Welcome input is capped at 2,000 in the setters. Name substitution (first name,
  -- at most 40 characters) may expand it, so a welcome gets a larger fixed ceiling.
  add constraint coach_feedback_text_length check (
    length(btrim(text)) > 0
    and char_length(text) <= case when kind = 'welcome' then 8000 else 2000 end
  );

create unique index if not exists coach_feedback_one_welcome
  on public.coach_feedback (coach_id, athlete_id) where kind = 'welcome';

-- Internal only. Keep the coach's formatting outside the placeholder and its separators.
create or replace function public.render_coach_welcome(p_text text, p_athlete uuid)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_name text := public.athlete_display_name(p_athlete);
  v_text text := p_text;
begin
  -- The profile helper returns 'Athlete' when it has no name. Keep it if it is
  -- actually this athlete's profile name.
  if v_name = 'Athlete' then
    select p.name into v_name
    from public.profiles p
    where p.auth_user_id = p_athlete
    order by p.updated_at desc nulls last
    limit 1;
  end if;
  v_name := nullif(btrim(regexp_replace(v_name, '[[:space:]]+', ' ', 'g')), '');
  if v_name is not null then
    return replace(v_text, '{first name}', left(split_part(v_name, ' ', 1), 40));
  end if;

  -- At a sentence or line ending, remove the delimiter before a missing name.
  v_text := regexp_replace(v_text, ',?[[:blank:]]*\{first name\}[[:blank:]]*(?=[.!?;:]|$)', '', 'gn');
  -- Else remove a trailing comma/space so the surrounding words can meet.
  v_text := regexp_replace(v_text, '\{first name\},?[[:blank:]]*', '', 'g');
  return regexp_replace(v_text, '^[[:space:]]+|[[:space:]]+$', '', 'g');
end;
$$;

create or replace function public.set_welcome_template(p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_text text := regexp_replace(coalesce(p_text, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  if not exists (select 1 from public.coach_profiles where user_id = auth.uid()) then
    raise exception 'not_coach' using errcode = '42501';
  end if;
  if char_length(v_text) > 2000 then
    raise exception 'text_too_long' using errcode = '22023';
  end if;

  update public.coach_profiles
  set welcome_template = nullif(v_text, '')
  where user_id = auth.uid();
end;
$$;

create or replace function public.claim_welcome_note()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.coach_athlete_links;
  v_template text;
  v_text text;
begin
  -- Serialize claims and overrides for this link, and check its status under the lock.
  select l.* into v_link
  from public.coach_athlete_links l
  where l.athlete_id = auth.uid() and l.status = 'active'
  for update;
  if not found then
    raise exception 'not_linked' using errcode = '42501';
  end if;
  if v_link.welcome_claimed_at is not null then
    return;
  end if;

  update public.coach_athlete_links set welcome_claimed_at = now() where id = v_link.id;

  select cp.welcome_template into v_template
  from public.coach_profiles cp where cp.user_id = v_link.coach_id;
  -- A welcome (or override) written for this link wins. One from an earlier link
  -- with the same coach is replaced below, so a returning athlete is welcomed again.
  if v_template is null or exists (
    select 1 from public.coach_feedback f
    where f.coach_id = v_link.coach_id and f.athlete_id = v_link.athlete_id and f.kind = 'welcome'
      and f.created_at >= v_link.consented_at
  ) then
    return;
  end if;
  v_text := public.render_coach_welcome(v_template, v_link.athlete_id);

  if nullif(v_text, '') is not null then
    insert into public.coach_feedback as f (coach_id, athlete_id, kind, text)
    values (v_link.coach_id, v_link.athlete_id, 'welcome', v_text)
    on conflict (coach_id, athlete_id) where kind = 'welcome' do update
    set text = excluded.text, created_at = now(), edited_at = null, read_at = null, revision = 0
    where f.created_at < v_link.consented_at;
  end if;
end;
$$;

create or replace function public.coach_set_athlete_welcome(p_athlete uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_text text := regexp_replace(coalesce(p_text, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_consented_at timestamptz;
begin
  if not public.is_active_coach_of(p_athlete) then
    raise exception 'not_linked' using errcode = '42501';
  end if;
  select l.consented_at into v_consented_at from public.coach_athlete_links l
  where l.coach_id = auth.uid() and l.athlete_id = p_athlete and l.status = 'active'
  for update;
  if not found then
    raise exception 'not_linked' using errcode = '42501';
  end if;

  if char_length(v_text) > 2000 then
    raise exception 'text_too_long' using errcode = '22023';
  end if;
  v_text := public.render_coach_welcome(v_text, p_athlete);
  if v_text = '' then
    raise exception 'empty_text' using errcode = '22023';
  end if;

  insert into public.coach_feedback as f (coach_id, athlete_id, kind, text)
  values (auth.uid(), p_athlete, 'welcome', v_text)
  on conflict (coach_id, athlete_id) where kind = 'welcome' do update
  set text = excluded.text,
      -- A new override on a rejoined link should appear on that link's Today.
      created_at = greatest(f.created_at, v_consented_at),
      -- A welcome from an earlier link is replaced as a fresh, unread note.
      read_at = case when f.created_at < v_consented_at then null else f.read_at end,
      edited_at = case
        when f.created_at < v_consented_at then null
        when f.text <> excluded.text then now()
        else f.edited_at
      end
  where f.read_at is null or f.created_at < v_consented_at;
  if not found then
    raise exception 'welcome_already_read' using errcode = 'P0001';
  end if;
end;
$$;

-- Load the editor from server state. Existing sent text and read status are scoped
-- to the coach's active athlete. With no athlete, read the caller's own template.
-- default_text is the coach's template, so the per-athlete editor can start from it.
drop function if exists public.get_coach_welcome(uuid);
create or replace function public.get_coach_welcome(p_athlete uuid default null)
returns table (coach_name text, saved_text text, can_edit boolean, default_text text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_athlete is not null and not public.is_active_coach_of(p_athlete) then
    raise exception 'not_linked' using errcode = '42501';
  end if;

  return query
  -- A welcome from an earlier link with this athlete counts as none.
  select cp.display_name,
         case when p_athlete is null then cp.welcome_template else f.text end,
         f.read_at is null,
         cp.welcome_template
  from public.coach_profiles cp
  left join public.coach_athlete_links l
    on l.coach_id = cp.user_id and l.athlete_id = p_athlete and l.status = 'active'
  left join public.coach_feedback f
    on f.coach_id = cp.user_id and f.athlete_id = p_athlete and f.kind = 'welcome'
   and f.created_at >= l.consented_at
  where cp.user_id = auth.uid();
end;
$$;

revoke all on function public.render_coach_welcome(text, uuid) from public, anon, authenticated;
revoke all on function public.set_welcome_template(text) from public, anon;
revoke all on function public.claim_welcome_note() from public, anon;
revoke all on function public.coach_set_athlete_welcome(uuid, text) from public, anon;
revoke all on function public.get_coach_welcome(uuid) from public, anon;
grant execute on function public.set_welcome_template(text) to authenticated;
grant execute on function public.claim_welcome_note() to authenticated;
grant execute on function public.coach_set_athlete_welcome(uuid, text) to authenticated;
grant execute on function public.get_coach_welcome(uuid) to authenticated;

-- Ordinary note edits cannot bypass the separate welcome read lock.
create or replace function public.coach_edit_feedback(
  p_id uuid,
  p_text text,
  p_coach uuid default null,
  p_revision integer default null
)
returns setof public.coach_feedback
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_text text := btrim(coalesce(p_text, ''));
  v_athlete uuid;
  v_revision integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_coach is not null and p_coach <> auth.uid() then
    raise exception 'wrong_coach' using errcode = '28000';
  end if;
  select f.athlete_id, f.revision into v_athlete, v_revision
  from public.coach_feedback f
  where f.id = p_id and f.coach_id = auth.uid() and f.kind = 'note'
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not public.is_active_coach_of(v_athlete) then
    raise exception 'not_linked' using errcode = 'P0001';
  end if;
  if v_text = '' then
    raise exception 'empty_text' using errcode = '22023';
  end if;
  if char_length(v_text) > 2000 then
    raise exception 'text_too_long' using errcode = '22023';
  end if;

  if p_revision is not null and p_revision <> v_revision then
    raise exception 'edit_conflict' using errcode = '40001';
  end if;

  return query
  update public.coach_feedback f
  set text = v_text, edited_at = now(), revision = f.revision + 1
  where f.id = p_id
  returning f.*;
end;
$$;

-- PostgreSQL requires dropping the old signature before adding a result column.
drop function if exists public.my_coach_feedback();
create or replace function public.my_coach_feedback()
returns table (
  id uuid,
  coach_id uuid,
  coach_name text,
  run_id bigint,
  run_source_provider text,
  run_source_activity_id text,
  week_start date,
  text text,
  created_at timestamptz,
  edited_at timestamptz,
  read_at timestamptz,
  kind text
)
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
    f.id,
    f.coach_id,
    coalesce(nullif(btrim(cp.display_name), ''), 'Coach'),
    f.run_id,
    r.source_provider,
    r.source_activity_id,
    f.week_start,
    f.text,
    f.created_at,
    f.edited_at,
    f.read_at,
    f.kind
  from public.coach_feedback f
  left join public.coach_profiles cp on cp.user_id = f.coach_id
  left join public.runs r on r.id = f.run_id
  where f.athlete_id = auth.uid()
  order by f.created_at desc;
end;
$$;

revoke all on function public.my_coach_feedback() from public, anon;
grant execute on function public.my_coach_feedback() to authenticated;

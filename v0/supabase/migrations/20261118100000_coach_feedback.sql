-- Coach Mode, Story 3.1: a coach writes feedback on one run or on one week.
--
-- Do not apply this to production from the app PR. Nadav applies
-- 20261118100000_coach_feedback.sql after review. Mirror it to the web repo
-- Running-coach- at v0/supabase/migrations/. Do not apply an older copy.
--
-- Depends on Story 1.2 (coach_profiles), Story 1.3 (coach_athlete_links),
-- Story 1.5 (purge_coach_data_for_deleted_account already deletes these rows
-- once this table exists), and Story 2.2 (is_active_coach_of).
--
-- runs.id is bigint (2026-11-14 live check, see 20261117164500_coach_read_rpcs),
-- so run_id is bigint. Text is trimmed, 1 to 2000 characters.
--
-- The athlete always reads their own rows, also after leaving. The coach reads
-- only while the link is active. There is no client insert, update, or delete
-- policy, and no delete anywhere in the MVP. Writes go through the two RPCs.
--
-- Both RPCs take the coach the app expects (p_coach). If the signed-in session is a
-- different user, they raise wrong_coach and write nothing, so a session that changes
-- while a queued note is sending can't publish one coach's text as another's.
-- Edits carry the revision they started from (p_revision). A stale edit raises
-- edit_conflict instead of overwriting a newer save from another phone.
--
-- Idempotent: create if not exists, guarded constraints, create or replace,
-- policies dropped and recreated, grants restated.

create table if not exists public.coach_feedback (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(user_id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  run_id bigint,
  week_start date,
  text text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  read_at timestamptz,
  revision integer not null default 0,
  constraint coach_feedback_one_target
    check ((run_id is null) <> (week_start is null)),
  constraint coach_feedback_text_length
    check (length(btrim(text)) > 0 and char_length(text) <= 2000)
);

alter table public.coach_feedback add column if not exists revision integer not null default 0;

-- The run FK only when runs exists, so the file also runs on a schema without it.
do $$
begin
  if to_regclass('public.runs') is not null and not exists (
    select 1 from pg_constraint
    where conrelid = 'public.coach_feedback'::regclass
      and conname = 'coach_feedback_run_id_fkey'
  ) then
    alter table public.coach_feedback
      add constraint coach_feedback_run_id_fkey
      foreign key (run_id) references public.runs(id) on delete cascade;
  end if;
end $$;

create index if not exists coach_feedback_athlete_idx
  on public.coach_feedback (athlete_id, created_at desc);
create index if not exists coach_feedback_coach_athlete_idx
  on public.coach_feedback (coach_id, athlete_id);
create index if not exists coach_feedback_run_idx
  on public.coach_feedback (run_id) where run_id is not null;

alter table public.coach_feedback enable row level security;

revoke all on table public.coach_feedback from public, anon, authenticated;
grant select on table public.coach_feedback to authenticated;

drop policy if exists coach_feedback_athlete_select on public.coach_feedback;
create policy coach_feedback_athlete_select on public.coach_feedback
  for select to authenticated
  using (athlete_id = (select auth.uid()));

drop policy if exists coach_feedback_coach_select on public.coach_feedback;
create policy coach_feedback_coach_select on public.coach_feedback
  for select to authenticated
  using (coach_id = (select auth.uid()) and public.is_active_coach_of(athlete_id));

-- RPCs -----------------------------------------------------------------------

-- Earlier drafts of this file had shorter signatures. Drop them so only one of each exists.
drop function if exists public.coach_add_feedback(uuid, bigint, date, text, uuid);
drop function if exists public.coach_edit_feedback(uuid, text);

-- p_id is optional and lets the app retry a queued note without a duplicate:
-- a second call with the same id returns the stored row.
create or replace function public.coach_add_feedback(
  p_athlete uuid,
  p_run bigint,
  p_week_start date,
  p_text text,
  p_id uuid default null,
  p_coach uuid default null
)
returns setof public.coach_feedback
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_text text := btrim(coalesce(p_text, ''));
  v_existing public.coach_feedback;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_coach is not null and p_coach <> auth.uid() then
    raise exception 'wrong_coach' using errcode = '28000';
  end if;
  if not public.is_active_coach_of(p_athlete) then
    raise exception 'not_linked' using errcode = 'P0001';
  end if;
  if v_text = '' then
    raise exception 'empty_text' using errcode = '22023';
  end if;
  if char_length(v_text) > 2000 then
    raise exception 'text_too_long' using errcode = '22023';
  end if;
  if (p_run is null) = (p_week_start is null) then
    raise exception 'one_target' using errcode = '22023';
  end if;
  if p_run is not null and not exists (
    select 1 from public.runs r where r.id = p_run and r.auth_user_id = p_athlete
  ) then
    raise exception 'run_not_found' using errcode = '22023';
  end if;

  if p_id is not null then
    select * into v_existing from public.coach_feedback f where f.id = p_id;
    if found then
      if v_existing.coach_id <> auth.uid() or v_existing.athlete_id <> p_athlete then
        raise exception 'id_conflict' using errcode = '23505';
      end if;
      return next v_existing;
      return;
    end if;
  end if;

  return query
  insert into public.coach_feedback (id, coach_id, athlete_id, run_id, week_start, text)
  values (coalesce(p_id, gen_random_uuid()), auth.uid(), p_athlete, p_run, p_week_start, v_text)
  returning *;
end;
$$;

-- Only the author, only while the link is active. read_at is unchanged.
-- With p_revision, the edit applies only if the row is still at that revision.
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
  where f.id = p_id and f.coach_id = auth.uid()
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

revoke all on function public.coach_add_feedback(uuid, bigint, date, text, uuid, uuid) from public, anon;
grant execute on function public.coach_add_feedback(uuid, bigint, date, text, uuid, uuid) to authenticated;
revoke all on function public.coach_edit_feedback(uuid, text, uuid, integer) from public, anon;
grant execute on function public.coach_edit_feedback(uuid, text, uuid, integer) to authenticated;

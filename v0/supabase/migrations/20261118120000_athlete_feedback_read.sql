-- Coach Mode, Story 3.2: the athlete reads the feedback a coach wrote (Story 3.1).
--
-- Do not apply this to production from the app PR. Nadav applies
-- 20261118120000_athlete_feedback_read.sql after review. Mirror it to the web repo
-- Running-coach- at v0/supabase/migrations/. Do not apply an older copy.
--
-- Depends on Story 3.1 (coach_feedback) and Story 1.2 (coach_profiles).
--
-- No new table and no policy change. coach_feedback keeps its RLS: the athlete can
-- already SELECT their own rows, but not coach_profiles (for the coach's name) and
-- not the run's source key. my_coach_feedback() returns both. It works for active
-- and revoked links alike: the athlete keeps what they received.
--
-- run_source_provider and run_source_activity_id are the runs upsert key. The app
-- matches a note to a local run with them, because runs.id differs from the local id.
--
-- mark_feedback_read() is the only way read_at changes. There is still no client
-- UPDATE policy, and it never touches text.
--
-- Idempotent: create or replace, then revoke and grant.

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
  read_at timestamptz
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
    f.read_at
  from public.coach_feedback f
  left join public.coach_profiles cp on cp.user_id = f.coach_id
  left join public.runs r on r.id = f.run_id
  where f.athlete_id = auth.uid()
  order by f.created_at desc;
end;
$$;

-- Only the athlete the row belongs to. Sets read_at once; never changes text.
create or replace function public.mark_feedback_read(p_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_read timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.coach_feedback f
  set read_at = now()
  where f.id = p_id and f.athlete_id = auth.uid() and f.read_at is null
  returning f.read_at into v_read;

  if v_read is null then
    select f.read_at into v_read
    from public.coach_feedback f
    where f.id = p_id and f.athlete_id = auth.uid();
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;
  return v_read;
end;
$$;

revoke all on function public.my_coach_feedback() from public, anon;
grant execute on function public.my_coach_feedback() to authenticated;
revoke all on function public.mark_feedback_read(uuid) from public, anon;
grant execute on function public.mark_feedback_read(uuid) to authenticated;

-- Runs link to the workout they completed (Story 0.2).
-- Idempotent: safe to re-run. Every step is skipped when already applied or
-- when a table is missing, so it also runs on schemas without `workouts`.
--
-- WEB REPO: this must also be copied into the web migration tree
-- (Running-coach-/v0/supabase/migrations/).
--
-- Live-schema check (production dxqglotcyirxzyqaxqln, 2026-11-14):
-- runs.workout_id did not exist. runs.id is bigint, workouts.id is uuid.
-- Existing owner RLS on runs (runs_update_own) already lets the signed-in
-- user set the column on their own rows, so no policy change is needed.

do $$
begin
    if to_regclass('public.runs') is null then
        raise notice 'public.runs is missing; skipping workout link';
        return;
    end if;

    alter table public.runs
        add column if not exists workout_id uuid;

    -- FK only when workouts exists and the constraint is not there yet.
    -- ON DELETE SET NULL: deleting a workout unlinks the run, never deletes it.
    if to_regclass('public.workouts') is not null
       and not exists (
           select 1
           from pg_constraint
           where conrelid = 'public.runs'::regclass
             and conname = 'runs_workout_id_fkey'
       ) then
        alter table public.runs
            add constraint runs_workout_id_fkey
            foreign key (workout_id) references public.workouts (id)
            on delete set null;
    end if;

    -- A workout links to at most one run. Unlinked runs (null) are unlimited.
    create unique index if not exists runs_workout_id_unique
        on public.runs (workout_id)
        where workout_id is not null;
end
$$;

-- Owner check ----------------------------------------------------------------
-- runs_update_own only checks runs.auth_user_id, so without this a user could
-- point their run at someone else's workout, take that workout's single unique
-- slot and block the real owner's link. The trigger rejects any non-null
-- workout_id whose workout the run's owner does not own.
-- "Owns" mirrors workouts_owner_access: workouts.auth_user_id = owner, or the
-- workout's plan has auth_user_id = owner. SECURITY DEFINER so the lookup is not
-- filtered by the caller's RLS on workouts and plans.
do $$
begin
    if to_regclass('public.runs') is null
       or to_regclass('public.workouts') is null
       or to_regclass('public.plans') is null then
        raise notice 'runs, workouts or plans is missing; skipping workout owner trigger';
        return;
    end if;

    create or replace function public.runs_enforce_workout_owner()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    begin
        if new.workout_id is null then
            return new;
        end if;

        if not exists (
            select 1
            from public.workouts w
            where w.id = new.workout_id
              and (
                  w.auth_user_id = new.auth_user_id
                  or exists (
                      select 1
                      from public.plans p
                      where p.id = w.plan_id
                        and p.auth_user_id = new.auth_user_id
                  )
              )
        ) then
            raise exception 'runs.workout_id must reference a workout owned by the same user'
                using errcode = '42501';
        end if;

        return new;
    end
    $fn$;

    revoke execute on function public.runs_enforce_workout_owner() from public, anon, authenticated;

    -- auth_user_id is listed too, so changing a run's owner cannot keep a link to the old owner's workout.
    if not exists (
        select 1
        from pg_trigger
        where tgrelid = 'public.runs'::regclass
          and tgname = 'runs_enforce_workout_owner'
          and not tgisinternal
    ) then
        create trigger runs_enforce_workout_owner
            before insert or update of workout_id, auth_user_id on public.runs
            for each row
            execute function public.runs_enforce_workout_owner();
    end if;
end
$$;

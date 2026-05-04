-- Repair cross-platform training plan ownership, Garmin read models, and wellness check-ins.

alter table public.plans
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists local_id bigint;

alter table public.workouts
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists local_id bigint,
  add column if not exists completed_at timestamptz,
  add column if not exists actual_distance_km numeric,
  add column if not exists actual_duration_minutes integer,
  add column if not exists actual_pace integer;

update public.plans
set auth_user_id = profile_id
where auth_user_id is null
  and profile_id is not null;

update public.workouts w
set auth_user_id = p.auth_user_id
from public.plans p
where w.plan_id = p.id
  and w.auth_user_id is null;

create index if not exists idx_plans_auth_user_id on public.plans(auth_user_id);
create index if not exists idx_plans_auth_active on public.plans(auth_user_id, is_active);
create unique index if not exists idx_plans_auth_local_id_unique
  on public.plans(auth_user_id, local_id)
  where local_id is not null and auth_user_id is not null;

create index if not exists idx_workouts_auth_user_id on public.workouts(auth_user_id);
create index if not exists idx_workouts_auth_scheduled_date on public.workouts(auth_user_id, scheduled_date);
create unique index if not exists idx_workouts_plan_local_id_unique
  on public.workouts(plan_id, local_id)
  where local_id is not null;
create index if not exists idx_workouts_completed_at on public.workouts(completed_at);

create table if not exists public.wellness_checkins (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  energy integer check (energy between 1 and 10),
  soreness integer check (soreness between 1 and 10),
  mood text,
  stress integer check (stress between 1 and 10),
  fatigue integer check (fatigue between 1 and 10),
  notes text,
  source text not null default 'manual' check (source in ('manual', 'garmin_fallback')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id, checkin_date)
);

alter table public.wellness_checkins enable row level security;

create index if not exists idx_wellness_checkins_auth_date
  on public.wellness_checkins(auth_user_id, checkin_date desc);

create or replace view public.garmin_activities_deduped
with (security_invoker = true) as
select distinct on (auth_user_id, activity_id)
  *
from public.garmin_activities
where auth_user_id is not null
order by auth_user_id, activity_id, updated_at desc nulls last, created_at desc;

create or replace view public.garmin_daily_metrics_deduped
with (security_invoker = true) as
select distinct on (auth_user_id, date)
  *
from public.garmin_daily_metrics
where auth_user_id is not null
order by auth_user_id, date, updated_at desc nulls last, created_at desc;

grant select on public.garmin_activities_deduped to authenticated;
grant select on public.garmin_daily_metrics_deduped to authenticated;
grant select, insert, update on public.wellness_checkins to authenticated;

drop policy if exists "Authenticated users can manage plans" on public.plans;
drop policy if exists "plans_owner_access" on public.plans;
create policy "plans_owner_access"
  on public.plans
  for all
  to authenticated
  using (auth_user_id = (select auth.uid()) or profile_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()) and profile_id = (select auth.uid()));

drop policy if exists "Authenticated users can manage workouts" on public.workouts;
drop policy if exists "workouts_owner_access" on public.workouts;
create policy "workouts_owner_access"
  on public.workouts
  for all
  to authenticated
  using (
    auth_user_id = (select auth.uid())
    or exists (
      select 1 from public.plans p
      where p.id = workouts.plan_id
        and (p.auth_user_id = (select auth.uid()) or p.profile_id = (select auth.uid()))
    )
  )
  with check (
    auth_user_id = (select auth.uid())
    and exists (
      select 1 from public.plans p
      where p.id = workouts.plan_id
        and (p.auth_user_id = (select auth.uid()) or p.profile_id = (select auth.uid()))
    )
  );

drop policy if exists "wellness_checkins_owner_access" on public.wellness_checkins;
create policy "wellness_checkins_owner_access"
  on public.wellness_checkins
  for all
  to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

comment on column public.plans.auth_user_id is 'Canonical cross-platform owner for web and iOS training plans.';
comment on column public.workouts.auth_user_id is 'Denormalized canonical owner for RLS and mobile workout reads.';
comment on table public.wellness_checkins is 'Manual morning check-ins used when Garmin wellness data is disconnected or stale.';

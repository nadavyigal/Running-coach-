-- Garmin auto-sync pipeline consolidation
-- Reuses existing garmin_connections / garmin_tokens tables and adds DB-backed
-- webhook + import job primitives so Vercel can process Garmin deliveries
-- without Redis.

begin;

alter table public.garmin_connections
  add column if not exists profile_id bigint references public.profiles(id) on delete set null,
  add column if not exists provider_user_id text,
  add column if not exists last_successful_sync_at timestamptz,
  add column if not exists last_sync_error text,
  add column if not exists last_webhook_received_at timestamptz;

update public.garmin_connections
set provider_user_id = coalesce(provider_user_id, garmin_user_id)
where provider_user_id is null;

update public.garmin_connections gc
set profile_id = p.id
from public.profiles p
where gc.profile_id is null
  and gc.auth_user_id is not null
  and p.auth_user_id = gc.auth_user_id;

update public.garmin_connections
set last_successful_sync_at = coalesce(last_successful_sync_at, last_sync_at)
where last_successful_sync_at is null
  and last_sync_at is not null;

do $$
declare
  existing_constraint text;
begin
  select con.conname
  into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'garmin_connections'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%connected%revoked%error%disconnected%';

  if existing_constraint is not null then
    execute format('alter table public.garmin_connections drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.garmin_connections
  drop constraint if exists garmin_connections_status_check;

alter table public.garmin_connections
  add constraint garmin_connections_status_check
  check (status in ('connected', 'revoked', 'error', 'disconnected', 'reauth_required'));

create index if not exists idx_garmin_connections_profile_id
  on public.garmin_connections(profile_id);

create index if not exists idx_garmin_connections_provider_user_id
  on public.garmin_connections(provider_user_id);

create index if not exists idx_garmin_connections_last_successful_sync_at
  on public.garmin_connections(last_successful_sync_at desc);

create table if not exists public.garmin_webhook_events (
  id uuid primary key default gen_random_uuid(),
  delivery_key text not null unique,
  event_type text not null,
  provider_user_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received'
    check (status in ('received', 'queued', 'processed', 'failed', 'ignored_duplicate')),
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0)
);

create index if not exists idx_garmin_webhook_events_provider_user_id
  on public.garmin_webhook_events(provider_user_id);

create index if not exists idx_garmin_webhook_events_status
  on public.garmin_webhook_events(status);

create index if not exists idx_garmin_webhook_events_received_at
  on public.garmin_webhook_events(received_at desc);

create table if not exists public.garmin_import_jobs (
  id uuid primary key default gen_random_uuid(),
  webhook_event_id uuid references public.garmin_webhook_events(id) on delete set null,
  user_id bigint,
  profile_id bigint references public.profiles(id) on delete set null,
  provider_user_id text,
  source_activity_id text,
  job_type text not null
    check (job_type in ('activity_import', 'backfill')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'retry', 'success', 'failed', 'dead_letter')),
  priority smallint not null default 100,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_garmin_import_jobs_claim
  on public.garmin_import_jobs(status, run_after asc, priority asc, created_at asc);

create index if not exists idx_garmin_import_jobs_user_id
  on public.garmin_import_jobs(user_id);

create index if not exists idx_garmin_import_jobs_profile_id
  on public.garmin_import_jobs(profile_id);

create index if not exists idx_garmin_import_jobs_webhook_event_id
  on public.garmin_import_jobs(webhook_event_id);

create unique index if not exists idx_garmin_import_jobs_dedupe
  on public.garmin_import_jobs(
    coalesce(webhook_event_id::text, 'none'),
    coalesce(user_id::text, 'none'),
    job_type,
    coalesce(source_activity_id, 'none')
  );

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'runs'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'runs' and column_name = 'source_provider'
    ) then
      alter table public.runs
        add column source_provider text,
        add column source_activity_id text,
        add column source_external_id text,
        add column source_payload_ref text;

      create unique index if not exists idx_runs_source_provider_activity_unique
        on public.runs(source_provider, source_activity_id)
        where source_provider is not null
          and source_activity_id is not null;

      create index if not exists idx_runs_source_provider_completed_at
        on public.runs(source_provider, completed_at desc)
        where source_provider is not null;
    end if;
  end if;
end $$;

create or replace function public.claim_garmin_import_jobs(
  p_limit integer default 10,
  p_worker_id text default 'unknown-worker'
)
returns setof public.garmin_import_jobs
language plpgsql
security definer
as $$
begin
  return query
  with candidate_jobs as (
    select id
    from public.garmin_import_jobs
    where status in ('pending', 'retry')
      and run_after <= now()
    order by priority asc, created_at asc
    limit greatest(coalesce(p_limit, 1), 1)
    for update skip locked
  ), updated_jobs as (
    update public.garmin_import_jobs jobs
    set status = 'running',
        locked_at = now(),
        locked_by = coalesce(p_worker_id, 'unknown-worker'),
        attempt_count = jobs.attempt_count + 1,
        updated_at = now()
    from candidate_jobs
    where jobs.id = candidate_jobs.id
    returning jobs.*
  )
  select * from updated_jobs;
end;
$$;

create or replace function public.requeue_garmin_import_job(
  p_job_id uuid,
  p_run_after timestamptz default now(),
  p_last_error text default null
)
returns public.garmin_import_jobs
language plpgsql
security definer
as $$
declare
  updated_job public.garmin_import_jobs;
begin
  update public.garmin_import_jobs
  set status = 'retry',
      run_after = coalesce(p_run_after, now()),
      last_error = p_last_error,
      locked_at = null,
      locked_by = null,
      updated_at = now()
  where id = p_job_id
  returning * into updated_job;

  return updated_job;
end;
$$;

create or replace function public.fail_garmin_import_job(
  p_job_id uuid,
  p_last_error text default null,
  p_dead_letter boolean default false
)
returns public.garmin_import_jobs
language plpgsql
security definer
as $$
declare
  updated_job public.garmin_import_jobs;
begin
  update public.garmin_import_jobs
  set status = case when coalesce(p_dead_letter, false) then 'dead_letter' else 'failed' end,
      last_error = p_last_error,
      locked_at = null,
      locked_by = null,
      updated_at = now()
  where id = p_job_id
  returning * into updated_job;

  return updated_job;
end;
$$;

drop trigger if exists update_garmin_import_jobs_updated_at on public.garmin_import_jobs;
create trigger update_garmin_import_jobs_updated_at
  before update on public.garmin_import_jobs
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_garmin_connections_updated_at on public.garmin_connections;
create trigger update_garmin_connections_updated_at
  before update on public.garmin_connections
  for each row execute function public.update_updated_at_column();

alter table public.garmin_webhook_events enable row level security;
alter table public.garmin_import_jobs enable row level security;

drop policy if exists "service_role_garmin_webhook_events" on public.garmin_webhook_events;
create policy "service_role_garmin_webhook_events"
  on public.garmin_webhook_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service_role_garmin_import_jobs" on public.garmin_import_jobs;
create policy "service_role_garmin_import_jobs"
  on public.garmin_import_jobs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

revoke all on table public.garmin_webhook_events from anon, authenticated;
revoke all on table public.garmin_import_jobs from anon, authenticated;

commit;

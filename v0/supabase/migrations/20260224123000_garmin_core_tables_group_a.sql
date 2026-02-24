-- Group A (P0): Garmin core security + sync reliability hardening
-- Non-destructive migration that aligns existing Garmin tables to Group A requirements.

-- -----------------------------------------------------------------------------
-- garmin_connections
-- -----------------------------------------------------------------------------

create table if not exists public.garmin_connections (
  id bigserial primary key,
  user_id bigint not null unique,
  auth_user_id uuid null references auth.users(id) on delete set null,
  garmin_user_id text,
  scopes text[] not null default '{}'::text[],
  status text not null default 'connected',
  connected_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_sync_at timestamptz,
  last_sync_cursor text,
  error_state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.garmin_connections add column if not exists garmin_user_id text;
alter table public.garmin_connections add column if not exists scopes text[] not null default '{}'::text[];
alter table public.garmin_connections add column if not exists status text not null default 'connected';
alter table public.garmin_connections add column if not exists connected_at timestamptz not null default now();
alter table public.garmin_connections add column if not exists revoked_at timestamptz;
alter table public.garmin_connections add column if not exists last_sync_at timestamptz;
alter table public.garmin_connections add column if not exists last_sync_cursor text;
alter table public.garmin_connections add column if not exists error_state jsonb;
alter table public.garmin_connections add column if not exists created_at timestamptz not null default now();
alter table public.garmin_connections add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_garmin_connections_user_id on public.garmin_connections(user_id);
create index if not exists idx_garmin_connections_last_sync_at on public.garmin_connections(last_sync_at desc);

-- -----------------------------------------------------------------------------
-- garmin_tokens (server-only token storage)
-- -----------------------------------------------------------------------------

create table if not exists public.garmin_tokens (
  id bigserial primary key,
  user_id bigint not null unique,
  auth_user_id uuid null references auth.users(id) on delete set null,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  expires_at timestamptz not null,
  rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.garmin_tokens add column if not exists access_token_encrypted text;
alter table public.garmin_tokens add column if not exists refresh_token_encrypted text;
alter table public.garmin_tokens add column if not exists expires_at timestamptz;
alter table public.garmin_tokens add column if not exists rotated_at timestamptz not null default now();
alter table public.garmin_tokens add column if not exists created_at timestamptz not null default now();
alter table public.garmin_tokens add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_garmin_tokens_user_id on public.garmin_tokens(user_id);
create index if not exists idx_garmin_tokens_expires_at on public.garmin_tokens(expires_at);

-- -----------------------------------------------------------------------------
-- garmin_activities
-- -----------------------------------------------------------------------------

create table if not exists public.garmin_activities (
  id bigserial primary key,
  user_id bigint not null,
  auth_user_id uuid null references auth.users(id) on delete set null,
  activity_id text not null,
  start_time timestamptz,
  sport text,
  duration_s integer,
  distance_m numeric,
  avg_hr integer,
  max_hr integer,
  avg_pace double precision,
  avg_pace_s_per_km numeric,
  elevation_gain_m numeric,
  calories numeric,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garmin_activities_user_activity_unique unique (user_id, activity_id)
);

alter table public.garmin_activities add column if not exists start_time timestamptz;
alter table public.garmin_activities add column if not exists sport text;
alter table public.garmin_activities add column if not exists duration_s integer;
alter table public.garmin_activities add column if not exists distance_m numeric;
alter table public.garmin_activities add column if not exists avg_hr integer;
alter table public.garmin_activities add column if not exists max_hr integer;
alter table public.garmin_activities add column if not exists avg_pace double precision;
alter table public.garmin_activities add column if not exists avg_pace_s_per_km numeric;
alter table public.garmin_activities add column if not exists elevation_gain_m numeric;
alter table public.garmin_activities add column if not exists calories numeric;
alter table public.garmin_activities add column if not exists raw_json jsonb not null default '{}'::jsonb;
alter table public.garmin_activities add column if not exists created_at timestamptz not null default now();
alter table public.garmin_activities add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_garmin_activities_user_activity
  on public.garmin_activities(user_id, activity_id);
create index if not exists idx_garmin_activities_user_time
  on public.garmin_activities(user_id, start_time desc);

-- -----------------------------------------------------------------------------
-- garmin_daily_metrics
-- -----------------------------------------------------------------------------

create table if not exists public.garmin_daily_metrics (
  id bigserial primary key,
  user_id bigint not null,
  auth_user_id uuid null references auth.users(id) on delete set null,
  date date not null,
  steps integer,
  sleep_score numeric,
  sleep_duration_s integer,
  hrv numeric,
  resting_hr integer,
  stress numeric,
  body_battery numeric,
  vo2max numeric,
  calories numeric,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garmin_daily_metrics_user_date_unique unique (user_id, date)
);

alter table public.garmin_daily_metrics add column if not exists date date;
alter table public.garmin_daily_metrics add column if not exists steps integer;
alter table public.garmin_daily_metrics add column if not exists sleep_score numeric;
alter table public.garmin_daily_metrics add column if not exists sleep_duration_s integer;
alter table public.garmin_daily_metrics add column if not exists hrv numeric;
alter table public.garmin_daily_metrics add column if not exists resting_hr integer;
alter table public.garmin_daily_metrics add column if not exists stress numeric;
alter table public.garmin_daily_metrics add column if not exists body_battery numeric;
alter table public.garmin_daily_metrics add column if not exists vo2max numeric;
alter table public.garmin_daily_metrics add column if not exists calories numeric;
alter table public.garmin_daily_metrics add column if not exists raw_json jsonb not null default '{}'::jsonb;
alter table public.garmin_daily_metrics add column if not exists created_at timestamptz not null default now();
alter table public.garmin_daily_metrics add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_garmin_daily_user_date_unique
  on public.garmin_daily_metrics(user_id, date);
create index if not exists idx_garmin_daily_user_day
  on public.garmin_daily_metrics(user_id, date desc);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.garmin_connections enable row level security;
alter table public.garmin_tokens enable row level security;
alter table public.garmin_activities enable row level security;
alter table public.garmin_daily_metrics enable row level security;

drop policy if exists "garmin_connections_select_own" on public.garmin_connections;
drop policy if exists "garmin_connections_update_own" on public.garmin_connections;
drop policy if exists "garmin_connections_rw_own" on public.garmin_connections;
create policy "garmin_connections_rw_own" on public.garmin_connections
for all using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

drop policy if exists "garmin_activities_select_own" on public.garmin_activities;
drop policy if exists "garmin_activities_insert_own" on public.garmin_activities;
drop policy if exists "garmin_activities_update_own" on public.garmin_activities;
drop policy if exists "garmin_activities_rw_own" on public.garmin_activities;
create policy "garmin_activities_rw_own" on public.garmin_activities
for all using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

drop policy if exists "garmin_daily_metrics_select_own" on public.garmin_daily_metrics;
drop policy if exists "garmin_daily_metrics_insert_own" on public.garmin_daily_metrics;
drop policy if exists "garmin_daily_metrics_update_own" on public.garmin_daily_metrics;
drop policy if exists "garmin_daily_metrics_rw_own" on public.garmin_daily_metrics;
create policy "garmin_daily_metrics_rw_own" on public.garmin_daily_metrics
for all using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- Keep token table server-only.
drop policy if exists "garmin_tokens_rw_own" on public.garmin_tokens;
revoke all on table public.garmin_tokens from anon, authenticated;


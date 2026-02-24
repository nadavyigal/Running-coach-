-- Group B (P1): Deterministic readiness + weekly reports + plan adjustment audit log
-- Non-destructive migration aligned with existing bigint user model.

-- -----------------------------------------------------------------------------
-- training_derived_metrics readiness explainability columns
-- -----------------------------------------------------------------------------

alter table if exists public.training_derived_metrics
  add column if not exists readiness_score numeric,
  add column if not exists readiness_state text,
  add column if not exists drivers jsonb,
  add column if not exists confidence text,
  add column if not exists confidence_reason text;

create index if not exists idx_training_derived_metrics_readiness
  on public.training_derived_metrics(user_id, date desc);

-- -----------------------------------------------------------------------------
-- ai_insights weekly lookup index (table already exists)
-- -----------------------------------------------------------------------------

create index if not exists idx_ai_insights_weekly_latest
  on public.ai_insights(user_id, type, period_end desc, created_at desc);

-- -----------------------------------------------------------------------------
-- plan_adjustments audit log
-- -----------------------------------------------------------------------------

create table if not exists public.plan_adjustments (
  id bigserial primary key,
  user_id bigint not null,
  auth_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  session_date date,
  old_session jsonb,
  new_session jsonb,
  reasons jsonb,
  evidence jsonb
);

create index if not exists idx_plan_adjustments_user_created
  on public.plan_adjustments(user_id, created_at desc);

create index if not exists idx_plan_adjustments_auth_user
  on public.plan_adjustments(auth_user_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.plan_adjustments enable row level security;

drop policy if exists "plan_adjustments_select_own" on public.plan_adjustments;
create policy "plan_adjustments_select_own"
  on public.plan_adjustments
  for select
  to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "plan_adjustments_insert_own" on public.plan_adjustments;
create policy "plan_adjustments_insert_own"
  on public.plan_adjustments
  for insert
  to authenticated
  with check (auth_user_id = auth.uid());

drop policy if exists "plan_adjustments_update_own" on public.plan_adjustments;
create policy "plan_adjustments_update_own"
  on public.plan_adjustments
  for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

revoke all on table public.plan_adjustments from anon;
grant select, insert, update on table public.plan_adjustments to authenticated;

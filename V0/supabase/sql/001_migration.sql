-- Supabase Migration: Story 9.4 — Supabase Migration (RS-SUP-009)
-- Creates schema, RLS, and finalize_onboarding RPC with idempotency

-- Extensions
create extension if not exists pgcrypto;

-- Enums
do $$ begin
  if not exists (select 1 from pg_type where typname = 'goal_enum') then
    create type goal_enum as enum ('habit','distance','speed');
  end if;
  if not exists (select 1 from pg_type where typname = 'experience_enum') then
    create type experience_enum as enum ('beginner','intermediate','advanced');
  end if;
end $$;

-- Tables
create table if not exists public.profiles (
  id uuid primary key,
  onboarding_complete boolean not null default false,
  goal goal_enum,
  experience experience_enum,
  days_per_week int check (days_per_week between 1 and 7),
  preferred_times text[],
  consents jsonb,
  privacy_settings jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_active boolean not null default false,
  meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists unique_active_plan_per_user on public.plans(user_id) where is_active;

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  scheduled_at timestamptz not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  operation text not null,
  idem_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, operation, idem_key)
);

-- Triggers for updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists set_plans_updated_at on public.plans;
create trigger set_plans_updated_at before update on public.plans for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.workouts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

-- Policies (owner-scoped)
do $$ begin
  -- profiles: users can select/update their own row
  if not exists (
    select 1 from pg_policies where tablename = 'profiles' and policyname = 'Profiles are self-accessible'
  ) then
    create policy "Profiles are self-accessible" on public.profiles
      for select using (id = auth.uid());
    create policy "Profiles can update self" on public.profiles
      for update using (id = auth.uid()) with check (id = auth.uid());
  end if;

  -- plans
  if not exists (
    select 1 from pg_policies where tablename = 'plans' and policyname = 'Plans are owner scoped'
  ) then
    create policy "Plans are owner scoped" on public.plans
      for select using (user_id = auth.uid());
    create policy "Plans owner update" on public.plans
      for update using (user_id = auth.uid()) with check (user_id = auth.uid());
    create policy "Plans owner insert" on public.plans
      for insert with check (user_id = auth.uid());
  end if;

  -- workouts
  if not exists (
    select 1 from pg_policies where tablename = 'workouts' and policyname = 'Workouts are owner scoped'
  ) then
    create policy "Workouts are owner scoped" on public.workouts
      for select using (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid()));
    create policy "Workouts owner write" on public.workouts
      for all using (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid()))
      with check (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid()));
  end if;

  -- conversations
  if not exists (
    select 1 from pg_policies where tablename = 'conversations' and policyname = 'Conversations owner'
  ) then
    create policy "Conversations owner" on public.conversations
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  -- conversation_messages
  if not exists (
    select 1 from pg_policies where tablename = 'conversation_messages' and policyname = 'Messages owner'
  ) then
    create policy "Messages owner" on public.conversation_messages
      for all using (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()))
      with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
  end if;
end $$;

-- RPC: finalize_onboarding
-- Parameters: p_profile jsonb, p_idempotency_key text, p_user_id uuid
create or replace function public.finalize_onboarding(
  p_profile jsonb,
  p_idempotency_key text default null,
  p_user_id uuid
)
returns table(user_id uuid, plan_id uuid) language plpgsql security definer as $$
declare
  v_user_id uuid := p_user_id;
  v_plan_id uuid;
  v_goal goal_enum;
  v_experience experience_enum;
  v_days int;
  v_preferred_times text[];
  v_consents jsonb;
  v_privacy jsonb;
  v_exists boolean := false;
begin
  if v_user_id is null then
    raise exception 'user id required';
  end if;

  -- Idempotency
  if p_idempotency_key is not null then
    select true into v_exists from public.idempotency_keys
      where user_id = v_user_id and operation = 'finalize_onboarding' and idem_key = p_idempotency_key;
    if v_exists then
      select id into v_plan_id from public.plans where user_id = v_user_id and is_active limit 1;
      if v_plan_id is null then
        -- Recover: ensure a plan exists even if key recorded earlier
        insert into public.plans(user_id, is_active) values (v_user_id, true) returning id into v_plan_id;
      end if;
      return query select v_user_id, v_plan_id;
    end if;
  end if;

  -- Extract profile
  v_goal := (p_profile->>'goal')::goal_enum;
  v_experience := (p_profile->>'experience')::experience_enum;
  v_days := nullif(p_profile->>'daysPerWeek','')::int;
  v_preferred_times := coalesce(array(select jsonb_array_elements_text(p_profile->'preferredTimes')), '{}');
  v_consents := coalesce(p_profile->'consents', '{}'::jsonb);
  v_privacy := coalesce(p_profile->'privacySettings', '{}'::jsonb);

  -- Upsert profile
  insert into public.profiles (id, onboarding_complete, goal, experience, days_per_week, preferred_times, consents, privacy_settings)
  values (v_user_id, true, v_goal, v_experience, v_days, v_preferred_times, v_consents, v_privacy)
  on conflict (id) do update set
    onboarding_complete = true,
    goal = excluded.goal,
    experience = excluded.experience,
    days_per_week = excluded.days_per_week,
    preferred_times = excluded.preferred_times,
    consents = excluded.consents,
    privacy_settings = excluded.privacy_settings,
    updated_at = now();

  -- Ensure single active plan
  select id into v_plan_id from public.plans where user_id = v_user_id and is_active limit 1;
  if v_plan_id is null then
    insert into public.plans(user_id, is_active) values (v_user_id, true) returning id into v_plan_id;
    -- Seed 3 workouts
    insert into public.workouts(plan_id, scheduled_at, details)
    values 
      (v_plan_id, now() + interval '1 day', jsonb_build_object('name','Easy Run','duration_min',30)),
      (v_plan_id, now() + interval '3 days', jsonb_build_object('name','Intervals','reps',6,'distance_m',400)),
      (v_plan_id, now() + interval '5 days', jsonb_build_object('name','Long Run','duration_min',45));
  end if;

  -- Record idempotency key
  if p_idempotency_key is not null then
    insert into public.idempotency_keys(user_id, operation, idem_key) values (v_user_id, 'finalize_onboarding', p_idempotency_key)
    on conflict do nothing;
  end if;

  return query select v_user_id, v_plan_id;
end $$;

grant execute on function public.finalize_onboarding(jsonb, text, uuid) to anon, authenticated, service_role;






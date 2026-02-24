-- Group C (P2): Challenges, streak loops, and retention scaffolding
-- Non-destructive migration aligned with bigint user model + auth_user_id pattern.

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  duration_days int not null default 21,
  rules jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_enrollments (
  user_id bigint not null,
  auth_user_id uuid null references auth.users(id) on delete set null,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  started_at date not null default current_date,
  completed_at date,
  progress jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

create table if not exists public.user_streaks (
  user_id bigint primary key,
  auth_user_id uuid null references auth.users(id) on delete set null,
  current_streak int not null default 0,
  best_streak int not null default 0,
  last_active_day date,
  updated_at timestamptz not null default now()
);

create index if not exists idx_challenge_enrollments_user_updated
  on public.challenge_enrollments(user_id, updated_at desc);

create index if not exists idx_challenge_enrollments_auth_user
  on public.challenge_enrollments(auth_user_id);

create index if not exists idx_challenges_slug
  on public.challenges(slug);

alter table public.challenges enable row level security;
alter table public.challenge_enrollments enable row level security;
alter table public.user_streaks enable row level security;

drop policy if exists "challenges_read_all" on public.challenges;
create policy "challenges_read_all"
  on public.challenges
  for select
  to authenticated
  using (true);

drop policy if exists "challenge_enrollments_rw_own" on public.challenge_enrollments;
create policy "challenge_enrollments_rw_own"
  on public.challenge_enrollments
  for all
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists "user_streaks_rw_own" on public.user_streaks;
create policy "user_streaks_rw_own"
  on public.user_streaks
  for all
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

revoke all on table public.challenges from anon;
revoke all on table public.challenge_enrollments from anon;
revoke all on table public.user_streaks from anon;

grant select on table public.challenges to authenticated;
grant select, insert, update on table public.challenge_enrollments to authenticated;
grant select, insert, update on table public.user_streaks to authenticated;

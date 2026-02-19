-- Storage table used by webhook-fed Garmin export summaries.
create table if not exists public.user_memory_snapshots (
  id bigserial primary key,
  device_id text not null unique,
  user_id bigint null,
  snapshot jsonb not null default '{}'::jsonb,
  summary jsonb null,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_memory_snapshots_user_id
  on public.user_memory_snapshots(user_id);

create index if not exists idx_user_memory_snapshots_updated_at
  on public.user_memory_snapshots(updated_at desc);

create index if not exists idx_user_memory_snapshots_device_prefix
  on public.user_memory_snapshots(device_id text_pattern_ops);

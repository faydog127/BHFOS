create table if not exists public.marketing_actions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'needs_approval',
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_marketing_actions_status_created
  on public.marketing_actions (status, created_at desc);

-- Project Operating System v1: tenant-scoped project registry for Ops Visibility dashboard.

create extension if not exists pgcrypto;
create table if not exists public.ops_projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  project_key text not null,
  name text not null,
  type text not null default 'project',
  owner text,
  status text not null default 'queued',
  stage text not null default 'discovery',
  outcome text,
  definition_of_done jsonb not null default '[]'::jsonb,
  next_action text,
  dependencies jsonb not null default '[]'::jsonb,
  priority_score integer not null default 0,
  risk text not null default 'med',
  blast_radius text,
  emergency boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ops_projects_project_key_tenant_uniq unique (tenant_id, project_key),
  constraint ops_projects_priority_score_range check (priority_score >= 0 and priority_score <= 12),
  constraint ops_projects_type_check check (type in ('project', 'change')),
  constraint ops_projects_status_check check (status in ('active', 'queued', 'paused', 'blocked', 'complete')),
  constraint ops_projects_stage_check check (stage in ('discovery', 'design', 'build', 'test', 'deploy')),
  constraint ops_projects_risk_check check (risk in ('low', 'med', 'high'))
);
create index if not exists ops_projects_tenant_id_idx on public.ops_projects (tenant_id);
create index if not exists ops_projects_tenant_status_idx on public.ops_projects (tenant_id, status);
create index if not exists ops_projects_updated_at_idx on public.ops_projects (updated_at desc);
alter table public.ops_projects enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ops_projects'
      and policyname = 'Ops projects readable by tenant'
  ) then
    create policy "Ops projects readable by tenant"
      on public.ops_projects
      for select
      to authenticated
      using (
        tenant_id = coalesce(
          auth.jwt() -> 'app_metadata' ->> 'tenant_id',
          auth.jwt() -> 'user_metadata' ->> 'tenant_id'
        )
      );
  end if;
end
$$;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ops_projects'
      and policyname = 'Ops projects insertable by tenant'
  ) then
    create policy "Ops projects insertable by tenant"
      on public.ops_projects
      for insert
      to authenticated
      with check (
        tenant_id = coalesce(
          auth.jwt() -> 'app_metadata' ->> 'tenant_id',
          auth.jwt() -> 'user_metadata' ->> 'tenant_id'
        )
      );
  end if;
end
$$;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ops_projects'
      and policyname = 'Ops projects updatable by tenant'
  ) then
    create policy "Ops projects updatable by tenant"
      on public.ops_projects
      for update
      to authenticated
      using (
        tenant_id = coalesce(
          auth.jwt() -> 'app_metadata' ->> 'tenant_id',
          auth.jwt() -> 'user_metadata' ->> 'tenant_id'
        )
      )
      with check (
        tenant_id = coalesce(
          auth.jwt() -> 'app_metadata' ->> 'tenant_id',
          auth.jwt() -> 'user_metadata' ->> 'tenant_id'
        )
      );
  end if;
end
$$;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ops_projects'
      and policyname = 'Ops projects deletable by tenant'
  ) then
    create policy "Ops projects deletable by tenant"
      on public.ops_projects
      for delete
      to authenticated
      using (
        tenant_id = coalesce(
          auth.jwt() -> 'app_metadata' ->> 'tenant_id',
          auth.jwt() -> 'user_metadata' ->> 'tenant_id'
        )
      );
  end if;
end
$$;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ops_projects'
      and policyname = 'Ops projects service role full access'
  ) then
    create policy "Ops projects service role full access"
      on public.ops_projects
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

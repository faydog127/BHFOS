-- Ensure tenant-scoped authenticated access to jobs for dispatch scheduling updates.
-- Fixes Schedule PATCH returning 204 with zero updated rows when UPDATE policy is missing.

alter table public.jobs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'jobs'
      and policyname = 'Jobs are readable by tenant'
  ) then
    create policy "Jobs are readable by tenant"
      on public.jobs
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
      and tablename = 'jobs'
      and policyname = 'Jobs are insertable by tenant'
  ) then
    create policy "Jobs are insertable by tenant"
      on public.jobs
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
      and tablename = 'jobs'
      and policyname = 'Jobs are updatable by tenant'
  ) then
    create policy "Jobs are updatable by tenant"
      on public.jobs
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
      and tablename = 'jobs'
      and policyname = 'Jobs are deletable by tenant'
  ) then
    create policy "Jobs are deletable by tenant"
      on public.jobs
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
      and tablename = 'jobs'
      and policyname = 'Jobs service role full access'
  ) then
    create policy "Jobs service role full access"
      on public.jobs
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

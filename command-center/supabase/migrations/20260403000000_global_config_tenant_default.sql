-- Ensure global_config.tenant_id has a default for legacy migrations that insert rows without tenant_id.
-- This keeps local migration bootstraps portable after tenant_id was retrofitted as NOT NULL.

do $$
begin
  if to_regclass('public.global_config') is null then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'global_config'
      and column_name = 'tenant_id'
  ) then
    execute 'alter table public.global_config alter column tenant_id set default ''tvg''';
  end if;
end $$;

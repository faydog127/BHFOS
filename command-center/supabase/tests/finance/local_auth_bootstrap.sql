-- Disposable local harness for finance SQL tests.
-- Not a product migration. Do not apply this file to a hosted project.
-- It stubs auth.uid/auth.jwt and the tenant-immutability function the finance
-- migrations call. It does not disable triggers or constraints.

begin;

create schema if not exists extensions;
create schema if not exists auth;

create or replace function extensions.gen_random_uuid()
returns uuid
language sql
volatile
as $$
  select gen_random_uuid();
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select case
    when pg_catalog.current_setting('request.jwt.claims', true) is null
      or btrim(pg_catalog.current_setting('request.jwt.claims', true)) = ''
    then null
    else pg_catalog.current_setting('request.jwt.claims', true)::jsonb
  end;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;

create or replace function public.enforce_tenant_id_immutability()
returns trigger
language plpgsql
as $$
begin
  if (old.tenant_id is distinct from new.tenant_id) then
    raise exception
      'tenant_id is immutable on %.% (attempted % -> %)',
      tg_table_schema,
      tg_table_name,
      old.tenant_id,
      new.tenant_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

commit;

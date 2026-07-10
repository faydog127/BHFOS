begin;

-- Hosted production predates the canonical job_items definition in
-- 20260512180000. Reconcile that legacy table without deleting rows or
-- replacing any populated business values. Fresh databases do not have the
-- table yet, so they intentionally fall through to the canonical CREATE TABLE
-- in the next migration.
do $$
begin
  if to_regclass('public.job_items') is null then
    return;
  end if;

  alter table public.job_items
    add column if not exists tenant_id text,
    add column if not exists service_id uuid,
    add column if not exists total_price numeric,
    add column if not exists updated_at timestamptz;

  -- Fill only missing values. Existing non-null values remain authoritative.
  update public.job_items ji
  set tenant_id = j.tenant_id
  from public.jobs j
  where ji.job_id = j.id
    and nullif(btrim(ji.tenant_id), '') is null;

  update public.job_items
  set
    quantity = coalesce(quantity, 1),
    unit_price = coalesce(unit_price, 0),
    total_price = coalesce(total_price, coalesce(quantity, 1) * coalesce(unit_price, 0)),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, created_at, now())
  where quantity is null
     or unit_price is null
     or total_price is null
     or created_at is null
     or updated_at is null;

  -- Stop instead of guessing if legacy data cannot be reconciled safely.
  if exists (select 1 from public.job_items where job_id is null) then
    raise exception using
      errcode = '23502',
      message = 'job_items compatibility blocked: null job_id values require review';
  end if;

  if exists (
    select 1
    from public.job_items ji
    left join public.jobs j on j.id = ji.job_id
    where j.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'job_items compatibility blocked: orphan job_id values require review';
  end if;

  if exists (
    select 1
    from public.job_items ji
    join public.jobs j on j.id = ji.job_id
    where nullif(btrim(ji.tenant_id), '') is null
       or ji.tenant_id is distinct from j.tenant_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'job_items compatibility blocked: tenant_id could not be derived safely';
  end if;

  if exists (
    select 1
    from public.job_items ji
    left join public.price_book pb on pb.id = ji.service_id
    where ji.service_id is not null
      and pb.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'job_items compatibility blocked: orphan service_id values require review';
  end if;

  alter table public.job_items
    alter column tenant_id set not null,
    alter column job_id set not null,
    alter column quantity set default 1,
    alter column quantity set not null,
    alter column unit_price set default 0,
    alter column unit_price set not null,
    alter column created_at set default now(),
    alter column created_at set not null,
    alter column updated_at set default now(),
    alter column updated_at set not null;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_items'::regclass
      and contype = 'f'
      and conname = 'job_items_service_id_fkey'
  ) then
    alter table public.job_items
      add constraint job_items_service_id_fkey
      foreign key (service_id)
      references public.price_book(id)
      on delete set null;
  end if;
end
$$;

commit;

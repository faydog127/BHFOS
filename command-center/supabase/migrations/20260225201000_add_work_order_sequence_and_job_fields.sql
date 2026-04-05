-- Work order numbering + scheduling field normalization.
-- Adds server-side sequential WO-YYYY-XXXX allocation per tenant/year.

-- 1) Ensure jobs table has fields used by dispatch + money loop UI/functions.
alter table public.jobs
  add column if not exists work_order_number text,
  add column if not exists job_number text,
  add column if not exists quote_number text,
  add column if not exists scheduled_start timestamptz,
  add column if not exists scheduled_end timestamptz,
  add column if not exists technician_id uuid,
  add column if not exists service_address text,
  add column if not exists payment_status text,
  add column if not exists total_amount numeric,
  add column if not exists priority text,
  add column if not exists access_notes text;

-- Preserve existing behavior defaults where missing.
update public.jobs
set payment_status = coalesce(payment_status, 'unpaid')
where payment_status is null;

-- 2) Counter table for tenant/year sequential work order numbers.
create table if not exists public.work_order_sequences (
  tenant_id text not null,
  seq_year integer not null,
  last_value integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint work_order_sequences_pkey primary key (tenant_id, seq_year)
);

-- 3) Atomic allocator function.
create or replace function public.next_work_order_number(
  p_tenant_id text,
  p_created_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer;
  v_next integer;
begin
  if p_tenant_id is null or btrim(p_tenant_id) = '' then
    raise exception 'p_tenant_id is required';
  end if;

  v_year := extract(year from coalesce(p_created_at, now()))::integer;

  insert into public.work_order_sequences (tenant_id, seq_year, last_value, updated_at)
  values (p_tenant_id, v_year, 1, now())
  on conflict (tenant_id, seq_year)
  do update
    set last_value = public.work_order_sequences.last_value + 1,
        updated_at = now()
  returning last_value into v_next;

  return format('WO-%s-%s', v_year, lpad(v_next::text, 4, '0'));
end;
$$;

grant execute on function public.next_work_order_number(text, timestamptz) to authenticated, service_role;

-- 4) Helpful indexes.
create index if not exists jobs_scheduled_start_idx on public.jobs (scheduled_start);
create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_technician_id_idx on public.jobs (technician_id);
create unique index if not exists jobs_tenant_work_order_number_uidx
  on public.jobs (tenant_id, work_order_number)
  where work_order_number is not null;


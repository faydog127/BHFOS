-- H1b: Tenant immutability (tenant_id cannot change after insert)
-- Scope: public.jobs, public.quotes, public.invoices, public.leads, public.appointments

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

drop trigger if exists trg_tenant_id_immutable_jobs on public.jobs;
create trigger trg_tenant_id_immutable_jobs
before update on public.jobs
for each row
execute function public.enforce_tenant_id_immutability();

drop trigger if exists trg_tenant_id_immutable_quotes on public.quotes;
create trigger trg_tenant_id_immutable_quotes
before update on public.quotes
for each row
execute function public.enforce_tenant_id_immutability();

drop trigger if exists trg_tenant_id_immutable_invoices on public.invoices;
create trigger trg_tenant_id_immutable_invoices
before update on public.invoices
for each row
execute function public.enforce_tenant_id_immutability();

drop trigger if exists trg_tenant_id_immutable_leads on public.leads;
create trigger trg_tenant_id_immutable_leads
before update on public.leads
for each row
execute function public.enforce_tenant_id_immutability();

drop trigger if exists trg_tenant_id_immutable_appointments on public.appointments;
create trigger trg_tenant_id_immutable_appointments
before update on public.appointments
for each row
execute function public.enforce_tenant_id_immutability();


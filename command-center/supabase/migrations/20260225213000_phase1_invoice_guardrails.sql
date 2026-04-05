-- Phase 1 billing guardrails:
-- 1) allow multiple invoices per work order (deposit/progress/final)
-- 2) require linked work order and invoice_type
-- 3) require release approval before status='sent'
-- 4) prevent invoice totals from exceeding the work-order contract total

alter table public.invoices
  add column if not exists invoice_type text,
  add column if not exists release_approved boolean default false,
  add column if not exists release_approved_at timestamptz,
  add column if not exists release_approved_by uuid;

update public.invoices
set invoice_type = 'final'
where invoice_type is null or btrim(invoice_type) = '';

update public.invoices
set invoice_type = lower(invoice_type)
where invoice_type is not null;

update public.invoices
set release_approved = coalesce(release_approved, false)
where release_approved is null;

alter table public.invoices
  alter column invoice_type set default 'final',
  alter column release_approved set default false;

drop index if exists public.invoices_tenant_job_unique;

create index if not exists invoices_tenant_job_idx
  on public.invoices (tenant_id, job_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_invoice_type_check'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_invoice_type_check
      check (lower(invoice_type) in ('deposit', 'progress', 'final'));
  end if;
end $$;

create or replace function public.enforce_invoice_guardrails()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_job_status text;
  v_contract_total numeric := 0;
  v_previously_billed numeric := 0;
  v_new_total numeric := coalesce(new.total_amount, 0);
  v_status text := lower(coalesce(new.status, 'draft'));
begin
  if new.job_id is null then
    raise exception 'WORK_ORDER_REQUIRED';
  end if;

  new.invoice_type := lower(coalesce(new.invoice_type, 'final'));
  if new.invoice_type not in ('deposit', 'progress', 'final') then
    raise exception 'INVALID_INVOICE_TYPE';
  end if;

  new.release_approved := coalesce(new.release_approved, false);

  select lower(coalesce(j.status, '')),
         coalesce(j.total_amount, 0)
    into v_job_status, v_contract_total
  from public.jobs j
  where j.id = new.job_id
    and (new.tenant_id is null or j.tenant_id is not distinct from new.tenant_id)
  limit 1;

  if v_job_status is null then
    raise exception 'WORK_ORDER_NOT_FOUND';
  end if;

  if v_job_status = 'cancelled' then
    raise exception 'CANCELLED_WORK_ORDER_NOT_BILLABLE';
  end if;

  if v_status = 'sent' and new.release_approved is distinct from true then
    raise exception 'RELEASE_APPROVAL_REQUIRED';
  end if;

  if new.release_approved and new.release_approved_at is null then
    new.release_approved_at := now();
  end if;

  if v_contract_total > 0 and v_status <> 'void' then
    select coalesce(sum(coalesce(i.total_amount, 0)), 0)
      into v_previously_billed
    from public.invoices i
    where i.job_id = new.job_id
      and i.tenant_id is not distinct from new.tenant_id
      and i.id is distinct from new.id
      and lower(coalesce(i.status, 'draft')) <> 'void';

    if (v_previously_billed + v_new_total) > (v_contract_total + 0.009) then
      raise exception 'INVOICE_EXCEEDS_REMAINING_BALANCE';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoices_guardrails on public.invoices;

create trigger trg_invoices_guardrails
before insert or update of tenant_id, job_id, status, invoice_type, total_amount, release_approved, release_approved_at
on public.invoices
for each row
execute function public.enforce_invoice_guardrails();

begin;

-- Canonicalize quote statuses so there is exactly one "won" status.
create or replace function public.normalize_quote_status(p_status text)
returns text
language sql
immutable
as $$
  select case lower(btrim(coalesce(p_status, '')))
    when 'approved' then 'accepted'
    else lower(btrim(coalesce(p_status, '')))
  end
$$;

create or replace function public.trg_quotes_normalize_status()
returns trigger
language plpgsql
as $$
begin
  new.status := public.normalize_quote_status(new.status);
  return new;
end;
$$;

drop trigger if exists trg_quotes_normalize_status on public.quotes;
create trigger trg_quotes_normalize_status
before insert or update of status on public.quotes
for each row
execute function public.trg_quotes_normalize_status();

-- Ensure exactly 1 job per quote (idempotency + corruption prevention).
create unique index if not exists jobs_quote_id_unique
  on public.jobs (quote_id)
  where quote_id is not null;

-- Hybrid support: allow multiple invoices per job, but prevent "draft explosion" per type.
create unique index if not exists invoices_one_draft_per_job_type_uq
  on public.invoices (tenant_id, job_id, invoice_type)
  where job_id is not null
    and tenant_id is not null
    and lower(coalesce(status, '')) = 'draft';

-- Toggle: draft invoice on acceptance (default off). Job creation is always enforced.
insert into public.global_config (key, value)
values ('auto_create_draft_invoice_on_acceptance', 'false')
on conflict (key) do nothing;

create or replace function public.ensure_job_and_optional_draft_invoice_for_accepted_quote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_status text;
  v_old_status text;
  v_job_id uuid;
  v_auto text;
  v_should_invoice boolean := false;
begin
  v_new_status := public.normalize_quote_status(new.status);

  if tg_op = 'INSERT' then
    v_old_status := '';
  else
    v_old_status := public.normalize_quote_status(old.status);
  end if;

  -- Only act on transitions into accepted (or insert already accepted).
  if v_new_status <> 'accepted' or v_old_status = 'accepted' then
    return new;
  end if;

  -- Must have tenant_id to allocate WO numbers + keep data partitioned.
  if new.tenant_id is null or btrim(new.tenant_id) = '' then
    raise exception 'TENANT_ID_REQUIRED_FOR_ACCEPTED_QUOTE';
  end if;

  -- Create job idempotently. Any exception aborts the status write.
  insert into public.jobs (
    tenant_id,
    lead_id,
    quote_id,
    estimate_id,
    quote_number,
    status,
    payment_status,
    total_amount,
    work_order_number
  ) values (
    new.tenant_id,
    new.lead_id,
    new.id,
    new.estimate_id,
    new.quote_number,
    'unscheduled',
    'unpaid',
    coalesce(new.total_amount, 0),
    public.next_work_order_number(new.tenant_id, coalesce(new.created_at, now()))
  )
  on conflict (quote_id) where quote_id is not null
  do update set
    updated_at = now(),
    total_amount = coalesce(public.jobs.total_amount, excluded.total_amount)
  returning id into v_job_id;

  -- Observability.
  insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
  values (
    new.tenant_id,
    'quote',
    new.id,
    'QuoteAccepted_JobEnsured',
    'system',
    jsonb_build_object('job_id', v_job_id)
  );

  -- Optional: create a draft invoice on acceptance (Hybrid), behind a config flag.
  select value into v_auto
  from public.global_config
  where key = 'auto_create_draft_invoice_on_acceptance'
  limit 1;

  v_should_invoice := lower(btrim(coalesce(v_auto, 'false'))) in ('1','true','yes','on');

  if v_should_invoice then
    insert into public.invoices (
      tenant_id,
      lead_id,
      quote_id,
      job_id,
      estimate_id,
      status,
      invoice_type,
      release_approved,
      subtotal,
      tax_rate,
      tax_amount,
      total_amount,
      issue_date,
      due_date,
      customer_email,
      customer_name,
      customer_phone,
      notes
    ) values (
      new.tenant_id,
      new.lead_id,
      new.id,
      v_job_id,
      new.estimate_id,
      'draft',
      'final',
      false,
      new.subtotal,
      new.tax_rate,
      new.tax_amount,
      coalesce(new.total_amount, 0),
      current_date,
      coalesce(new.valid_until, current_date + 14),
      new.customer_email,
      new.customer_name,
      new.customer_phone,
      case when new.quote_number is not null
        then 'Draft created on acceptance for Quote #' || new.quote_number
        else 'Draft created on acceptance'
      end
    )
    on conflict (tenant_id, job_id, invoice_type)
      where lower(coalesce(status, '')) = 'draft'
    do nothing;

    insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
    values (
      new.tenant_id,
      'quote',
      new.id,
      'QuoteAccepted_DraftInvoiceEnsured',
      'system',
      jsonb_build_object('job_id', v_job_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_quotes_ensure_job_and_invoice on public.quotes;
create trigger trg_quotes_ensure_job_and_invoice
after insert or update of status on public.quotes
for each row
execute function public.ensure_job_and_optional_draft_invoice_for_accepted_quote();

commit;
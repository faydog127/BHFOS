-- Appendix A — Phase A-EXEC-3 (Task & Queue Integrity)
-- Additive-only: task normalization + Now Queue view

-- -------------------------------
-- A-TASK-01 Normalize task creation
-- -------------------------------

create or replace function public.ensure_follow_up_task(
  p_tenant_id text,
  p_source_type text,
  p_source_id uuid,
  p_lead_id uuid,
  p_title text,
  p_due_at timestamptz default null,
  p_priority text default 'medium',
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tenant_id is null or p_source_type is null or p_source_id is null or p_title is null then
    return;
  end if;

  perform 1
  from public.crm_tasks
  where tenant_id = p_tenant_id
    and type = 'follow_up'
    and source_type = p_source_type
    and source_id = p_source_id
    and title = p_title
    and status in ('open', 'new', 'pending', 'PENDING', 'in-progress')
  limit 1;

  if found then
    return;
  end if;

  insert into public.crm_tasks (
    tenant_id,
    lead_id,
    source_type,
    source_id,
    type,
    title,
    status,
    due_at,
    priority,
    notes,
    metadata,
    created_at,
    updated_at
  ) values (
    p_tenant_id,
    p_lead_id,
    p_source_type,
    p_source_id,
    'follow_up',
    p_title,
    'open',
    p_due_at,
    p_priority,
    p_notes,
    coalesce(p_metadata, '{}'::jsonb),
    now(),
    now()
  );
end;
$$;

create or replace function public.trg_money_loop_quote_followups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if lower(coalesce(new.status, '')) = 'sent' then
      perform public.ensure_follow_up_task(
        new.tenant_id,
        'quote',
        new.id,
        new.lead_id,
        'Quote Sent – Follow Up',
        null,
        'medium',
        null,
        jsonb_build_object('quote_number', new.quote_number)
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if lower(coalesce(new.status, '')) = 'sent'
      and lower(coalesce(old.status, '')) <> 'sent' then
      perform public.ensure_follow_up_task(
        new.tenant_id,
        'quote',
        new.id,
        new.lead_id,
        'Quote Sent – Follow Up',
        null,
        'medium',
        null,
        jsonb_build_object('quote_number', new.quote_number)
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_money_loop_quote_followups on public.quotes;
create trigger trg_money_loop_quote_followups
after insert or update of status on public.quotes
for each row
execute function public.trg_money_loop_quote_followups();

create or replace function public.trg_money_loop_invoice_followups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_status text;
  old_status text;
begin
  new_status := lower(coalesce(new.status, ''));
  old_status := lower(coalesce(old.status, ''));

  if tg_op = 'INSERT' then
    if new_status in ('sent', 'partial', 'overdue') then
      perform public.ensure_follow_up_task(
        new.tenant_id,
        'invoice',
        new.id,
        new.lead_id,
        'Invoice Unpaid – Follow Up',
        null,
        'high',
        null,
        jsonb_build_object('invoice_number', new.invoice_number, 'due_date', new.due_date)
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new_status in ('sent', 'partial', 'overdue')
      and old_status not in ('sent', 'partial', 'overdue') then
      perform public.ensure_follow_up_task(
        new.tenant_id,
        'invoice',
        new.id,
        new.lead_id,
        'Invoice Unpaid – Follow Up',
        null,
        'high',
        null,
        jsonb_build_object('invoice_number', new.invoice_number, 'due_date', new.due_date)
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_money_loop_invoice_followups on public.invoices;
create trigger trg_money_loop_invoice_followups
after insert or update of status on public.invoices
for each row
execute function public.trg_money_loop_invoice_followups();

create or replace function public.trg_money_loop_job_followups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if lower(coalesce(new.status, '')) = 'unscheduled' then
      perform public.ensure_follow_up_task(
        new.tenant_id,
        'job',
        new.id,
        new.lead_id,
        'Schedule Job',
        null,
        'high',
        null,
        jsonb_build_object('quote_id', new.quote_id)
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if lower(coalesce(new.status, '')) = 'unscheduled'
      and lower(coalesce(old.status, '')) <> 'unscheduled' then
      perform public.ensure_follow_up_task(
        new.tenant_id,
        'job',
        new.id,
        new.lead_id,
        'Schedule Job',
        null,
        'high',
        null,
        jsonb_build_object('quote_id', new.quote_id)
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_money_loop_job_followups on public.jobs;
create trigger trg_money_loop_job_followups
after insert or update of status on public.jobs
for each row
execute function public.trg_money_loop_job_followups();

-- -------------------------------
-- A-TASK-02 Now Queue (queryable view)
-- -------------------------------

create or replace view public.now_queue as
  with open_statuses as (
    select unnest(array['open','new','pending','PENDING','in-progress']) as status
  )
  select
    1 as priority,
    0 as subpriority,
    l.tenant_id,
    'lead'::text as item_type,
    l.id as entity_id,
    l.id as lead_id,
    concat('New lead: ', coalesce(l.first_name, ''), ' ', coalesce(l.last_name, '')) as title,
    l.created_at,
    null::timestamptz as due_at,
    jsonb_build_object('status', l.status, 'stage', l.stage) as metadata
  from public.leads l
  where lower(coalesce(l.status, '')) = 'new'
    and lower(coalesce(l.stage, '')) = 'new'

  union all

  select
    2 as priority,
    case
      when t.title ilike 'Quote Viewed%' then 0
      else 1
    end as subpriority,
    t.tenant_id,
    'task'::text as item_type,
    t.source_id as entity_id,
    t.lead_id,
    t.title,
    t.created_at,
    t.due_at,
    t.metadata
  from public.crm_tasks t
  where t.type = 'follow_up'
    and t.source_type = 'quote'
    and t.status in (select status from open_statuses)

  union all

  select
    3 as priority,
    0 as subpriority,
    t.tenant_id,
    'task'::text as item_type,
    t.source_id as entity_id,
    t.lead_id,
    t.title,
    t.created_at,
    t.due_at,
    t.metadata
  from public.crm_tasks t
  where t.type = 'follow_up'
    and t.source_type = 'job'
    and t.title = 'Schedule Job'
    and t.status in (select status from open_statuses)

  union all

  select
    4 as priority,
    case
      when t.title ilike 'Invoice Viewed%' then 0
      else 1
    end as subpriority,
    t.tenant_id,
    'task'::text as item_type,
    t.source_id as entity_id,
    t.lead_id,
    t.title,
    t.created_at,
    t.due_at,
    t.metadata
  from public.crm_tasks t
  where t.type = 'follow_up'
    and t.source_type = 'invoice'
    and t.status in (select status from open_statuses)

  union all

  select
    5 as priority,
    0 as subpriority,
    t.tenant_id,
    'task'::text as item_type,
    t.id as entity_id,
    t.lead_id,
    t.title,
    t.created_at,
    t.due_at,
    t.metadata
  from public.crm_tasks t
  where t.status in (select status from open_statuses)
    and coalesce(t.type, '') <> 'follow_up';


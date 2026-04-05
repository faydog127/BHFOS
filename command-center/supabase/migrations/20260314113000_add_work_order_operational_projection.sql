begin;

alter table public.jobs
  add column if not exists customer_type_snapshot text,
  add column if not exists payment_terms text;

update public.jobs
set payment_status = 'unpaid'
where lower(btrim(coalesce(payment_status, ''))) in ('pending', 'open');

create or replace function public.normalize_job_customer_type(p_value text)
returns text
language sql
immutable
as $$
  select case upper(btrim(coalesce(p_value, '')))
    when 'COMMERCIAL' then 'commercial'
    when 'GOVERNMENT' then 'commercial'
    when 'PROPERTY_MANAGEMENT' then 'property_management'
    when 'PROPERTY MANAGEMENT' then 'property_management'
    when 'PROPERTY_MANAGER' then 'property_management'
    when 'PROPERTY MANAGER' then 'property_management'
    when 'PARTNER' then 'property_management'
    else 'residential'
  end
$$;

create or replace function public.default_job_payment_terms(p_customer_type text)
returns text
language sql
immutable
as $$
  select case public.normalize_job_customer_type(p_customer_type)
    when 'property_management' then 'NET_30'
    when 'commercial' then 'NET_15'
    else 'NET_7'
  end
$$;

create or replace function public.payment_terms_due_days(p_payment_terms text)
returns integer
language sql
immutable
as $$
  select case upper(btrim(coalesce(p_payment_terms, '')))
    when 'NET_30' then 30
    when 'NET_15' then 15
    when 'DUE_ON_RECEIPT' then 0
    else 7
  end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'customer_type'
  ) then
    execute $sql$
      update public.jobs as j
      set customer_type_snapshot = coalesce(
        nullif(btrim(j.customer_type_snapshot), ''),
        public.normalize_job_customer_type(l.customer_type),
        'residential'
      )
      from public.leads as l
      where j.lead_id = l.id
        and (
          j.customer_type_snapshot is null
          or btrim(j.customer_type_snapshot) = ''
        )
    $sql$;
  end if;
end
$$;

update public.jobs
set customer_type_snapshot = 'residential'
where customer_type_snapshot is null
  or btrim(customer_type_snapshot) = '';

update public.jobs
set payment_terms = public.default_job_payment_terms(customer_type_snapshot)
where payment_terms is null
  or btrim(payment_terms) = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_customer_type_snapshot_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_customer_type_snapshot_check
      check (
        customer_type_snapshot is null
        or public.normalize_job_customer_type(customer_type_snapshot) in (
          'residential',
          'commercial',
          'property_management'
        )
      ) not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_payment_terms_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_payment_terms_check
      check (
        payment_terms is null
        or upper(btrim(payment_terms)) in (
          'NET_7',
          'NET_15',
          'NET_30',
          'DUE_ON_RECEIPT'
        )
      ) not valid;
  end if;
end
$$;

create or replace view public.job_operational_state_v1
with (security_invoker = true)
as
with latest_invoice as (
  select distinct on (i.job_id)
    i.job_id,
    i.id,
    lower(btrim(coalesce(i.status, ''))) as status,
    i.invoice_number,
    i.due_date,
    i.sent_at,
    i.balance_due,
    i.total_amount,
    i.created_at
  from public.invoices as i
  where i.job_id is not null
  order by i.job_id, i.created_at desc, i.id desc
),
base as (
  select
    j.id,
    j.tenant_id,
    lower(btrim(coalesce(j.status, 'unscheduled'))) as status,
    lower(btrim(coalesce(j.payment_status, 'unpaid'))) as payment_status,
    j.scheduled_start,
    j.scheduled_end,
    j.service_address,
    j.technician_id,
    j.updated_at,
    j.completed_at,
    j.total_amount,
    j.work_order_number,
    j.job_number,
    j.quote_id,
    j.quote_number,
    j.lead_id,
    j.created_at,
    upper(btrim(coalesce(j.payment_terms, public.default_job_payment_terms(j.customer_type_snapshot)))) as payment_terms,
    public.normalize_job_customer_type(j.customer_type_snapshot) as customer_type_snapshot,
    li.id as latest_invoice_id,
    li.status as latest_invoice_status,
    li.invoice_number as latest_invoice_number,
    li.due_date as latest_invoice_due_date,
    li.balance_due as latest_invoice_balance_due,
    l.first_name as lead_first_name,
    l.last_name as lead_last_name,
    l.phone as lead_phone,
    l.email as lead_email
  from public.jobs as j
  left join latest_invoice as li
    on li.job_id = j.id
  left join public.leads as l
    on l.id = j.lead_id
),
staged as (
  select
    b.*,
    case
      when b.payment_status = 'paid' or b.latest_invoice_status = 'paid' then 'paid'
      when b.latest_invoice_id is not null and b.latest_invoice_status = 'draft' then 'invoice_draft'
      when b.latest_invoice_id is not null and b.latest_invoice_status in ('sent', 'partial', 'overdue', 'accepted', 'approved') then 'invoiced'
      when b.status in ('unscheduled', 'pending_schedule', 'scheduled', 'en_route', 'in_progress', 'on_hold', 'completed', 'cancelled') then b.status
      else 'unscheduled'
    end as operational_stage
  from base as b
),
timed as (
  select
    s.*,
    case
      when s.operational_stage in ('unscheduled', 'pending_schedule')
        then coalesce(s.updated_at, s.created_at) + interval '24 hours'
      when s.operational_stage = 'scheduled'
        then s.scheduled_start
      when s.operational_stage = 'invoice_draft'
        then coalesce(s.completed_at, s.updated_at, s.created_at) + interval '12 hours'
      when s.operational_stage = 'invoiced'
        then coalesce(
          s.latest_invoice_due_date::timestamptz,
          s.completed_at + make_interval(days => public.payment_terms_due_days(s.payment_terms)),
          s.updated_at + make_interval(days => public.payment_terms_due_days(s.payment_terms))
        )
      else null
    end as due_at
  from staged as s
)
select
  t.*,
  case
    when t.operational_stage in ('unscheduled', 'pending_schedule') then 10
    when t.operational_stage = 'scheduled' then 20
    when t.operational_stage = 'en_route' then 30
    when t.operational_stage = 'in_progress' then 40
    when t.operational_stage = 'on_hold' then 45
    when t.operational_stage = 'invoice_draft' then 50
    when t.operational_stage = 'invoiced' then 60
    when t.operational_stage = 'completed' then 70
    when t.operational_stage = 'paid' then 80
    when t.operational_stage = 'cancelled' then 90
    else 95
  end as operational_sort,
  (
    t.due_at is not null
    and t.due_at < now()
    and t.operational_stage not in ('paid', 'cancelled')
  ) as is_overdue,
  case
    when t.due_at is null then null
    when t.due_at >= now() then null
    when t.operational_stage in ('unscheduled', 'pending_schedule') then 'Scheduling overdue'
    when t.operational_stage = 'scheduled' then 'Dispatch overdue'
    when t.operational_stage = 'invoice_draft' then 'Invoice draft overdue'
    when t.operational_stage = 'invoiced' then 'Invoice overdue'
    else 'Attention needed'
  end as overdue_reason,
  case
    when t.operational_stage in ('unscheduled', 'pending_schedule') then 'Schedule'
    when t.operational_stage = 'scheduled' then 'Start'
    when t.operational_stage in ('en_route', 'in_progress') then 'Complete'
    when t.operational_stage = 'invoice_draft' then 'Send Invoice'
    when t.operational_stage = 'invoiced' then 'Collect Payment'
    when t.operational_stage = 'paid' then 'Closed'
    when t.operational_stage = 'on_hold' then 'Resume'
    else 'Open'
  end as next_action_label
from timed as t;

grant select on public.job_operational_state_v1 to authenticated, service_role;

commit;

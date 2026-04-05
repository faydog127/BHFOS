-- Sprint 1: normalize jobs/payment status casing and add contract guardrails.
-- NOTE: constraints are added NOT VALID to avoid blocking deployment on legacy rows.
-- New writes will still be checked.

begin;

-- 1) Normalize casing/spacing first.
update public.jobs
set status = lower(btrim(status))
where status is not null
  and status <> lower(btrim(status));

update public.jobs
set payment_status = lower(btrim(payment_status))
where payment_status is not null
  and payment_status <> lower(btrim(payment_status));

-- 2) Canonicalize common legacy variants.
update public.jobs
set status = 'in_progress'
where status in ('inprogress', 'in-progress');

update public.jobs
set status = 'pending_schedule'
where status in ('pendingschedule', 'pending-schedule', 'pending schedule');

update public.jobs
set status = 'completed'
where status in ('complete', 'done');

update public.jobs
set payment_status = 'partial'
where payment_status in ('partial_paid', 'partially_paid');

-- 3) Add contract constraints for new writes.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_status_contract_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_status_contract_check
      check (
        status is null
        or status in (
          'pending',
          'unscheduled',
          'pending_schedule',
          'scheduled',
          'en_route',
          'started',
          'in_progress',
          'on_hold',
          'ready_to_invoice',
          'open',
          'completed',
          'closed',
          'cancelled'
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
    where conname = 'jobs_payment_status_contract_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_payment_status_contract_check
      check (
        payment_status is null
        or payment_status in (
          'unpaid',
          'partial',
          'paid',
          'refunded',
          'void'
        )
      ) not valid;
  end if;
end
$$;

commit;


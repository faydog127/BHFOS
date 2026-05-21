-- P0 Vocabulary Patch V1 (Patch 1)
-- Legalize jobs.status='invoiced' in the DB contract guardrail.
--
-- Notes:
-- - Keep constraint NOT VALID to avoid blocking on legacy rows.
-- - Do not remove existing allowed statuses in this patch (blast-radius control).

begin;

alter table public.jobs
  drop constraint if exists jobs_status_contract_check;

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
      'invoiced',
      'completed',
      'closed',
      'cancelled'
    )
  ) not valid;

commit;


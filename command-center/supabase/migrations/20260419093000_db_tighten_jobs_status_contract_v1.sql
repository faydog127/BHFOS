-- SURGICAL STRIKE PACKET V1 (Target A)
-- Scope: fix only the jobs.status default casing mismatch.
--
-- NOTE:
-- This intentionally does NOT tighten the jobs status contract check.
-- Contract tightening requires a controlled inventory pass in the target environment.

begin;

alter table public.jobs
  alter column status set default 'unscheduled';

commit;

-- Phase B hardening: explicit approval state for manual structured conditions.
-- AI-backed eligibility remains driven by suggestion accept/edit status.
-- Default draft keeps existing manual rows out of the Findings narrative until approved.

begin;

alter table public.inspection_findings
  add column if not exists condition_status text not null default 'draft';

alter table public.inspection_findings
  drop constraint if exists inspection_findings_condition_status_check;

alter table public.inspection_findings
  add constraint inspection_findings_condition_status_check
  check (condition_status in ('draft', 'approved', 'rejected', 'voided', 'not_relevant'));

comment on column public.inspection_findings.condition_status is
  'Manual condition review state. AI-backed narrative eligibility uses inspection_ai_suggestions.status; manuals require approved.';

commit;

-- Packet 006: Work Order v1 — add real execution fields to public.jobs (schema first)
-- Guardrails:
-- - Additive only
-- - No dispatch_id
-- - Do NOT add signature_url or photos_json in this packet

alter table public.jobs
  add column if not exists scope_summary text,
  add column if not exists special_conditions text,
  add column if not exists property_notes text,
  add column if not exists execution_checklist jsonb,
  add column if not exists execution_findings jsonb,
  add column if not exists execution_photos jsonb,
  add column if not exists technician_notes text,
  add column if not exists customer_summary text,
  add column if not exists follow_up_required boolean,
  add column if not exists follow_up_notes text,
  add column if not exists report_url text;

-- Safe defaults/backfills (avoid table rewrite on add-column-with-default).
alter table public.jobs
  alter column execution_checklist set default '[]'::jsonb,
  alter column execution_findings set default '[]'::jsonb,
  alter column execution_photos set default '[]'::jsonb,
  alter column follow_up_required set default false;

update public.jobs
set
  execution_checklist = coalesce(execution_checklist, '[]'::jsonb),
  execution_findings = coalesce(execution_findings, '[]'::jsonb),
  execution_photos = coalesce(execution_photos, '[]'::jsonb),
  follow_up_required = coalesce(follow_up_required, false),
  updated_at = coalesce(updated_at, now())
where
  execution_checklist is null
  or execution_findings is null
  or execution_photos is null
  or follow_up_required is null;

alter table public.jobs
  alter column execution_checklist set not null,
  alter column execution_findings set not null,
  alter column execution_photos set not null,
  alter column follow_up_required set not null;


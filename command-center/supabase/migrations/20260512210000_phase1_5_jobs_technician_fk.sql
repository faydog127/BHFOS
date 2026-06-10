begin;

-- Phase 1.5: Technician ID Contract (Jobs)
-- Canonical rule going forward:
--   jobs.technician_id references technicians.id
--
-- This migration is intentionally non-destructive:
--   1) backfill legacy rows that stored technicians.user_id
--   2) null out any orphan technician_id values that cannot be mapped
--   3) add FK constraint to prevent drift

-- 1) Backfill: jobs.technician_id currently equals technicians.user_id -> rewrite to technicians.id.
update public.jobs j
set
  technician_id = t.id,
  updated_at = coalesce(j.updated_at, now())
from public.technicians t
where j.technician_id is not null
  and t.user_id is not null
  and j.technician_id = t.user_id;

-- 2) Clean up: any technician_id that does not exist in technicians(id) becomes NULL.
-- (We do this after the backfill so we don't throw away mappable legacy values.)
update public.jobs j
set
  technician_id = null,
  updated_at = coalesce(j.updated_at, now())
where j.technician_id is not null
  and not exists (
    select 1
    from public.technicians t
    where t.id = j.technician_id
  );

-- 3) Enforce: add FK to technicians(id).
alter table public.jobs
  drop constraint if exists jobs_technician_id_fkey;

alter table public.jobs
  add constraint jobs_technician_id_fkey
  foreign key (technician_id)
  references public.technicians(id)
  on delete set null;

commit;


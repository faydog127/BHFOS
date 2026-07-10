begin;

-- Phase 1.5: Technician ID Contract (Jobs)
-- Canonical rule going forward:
--   jobs.technician_id references technicians.id
--
-- This migration is intentionally non-destructive:
--   1) fail if any value cannot map to technicians.id or technicians.user_id
--   2) backfill legacy rows that stored technicians.user_id
--   3) verify every remaining non-null value is technicians.id
--   4) add FK constraint to prevent drift

-- 1) Stop instead of deleting or nulling an unknown technician assignment.
do $$
declare
  v_unmapped_count bigint;
begin
  select count(*)
  into v_unmapped_count
  from public.jobs j
  where j.technician_id is not null
    and not exists (
      select 1
      from public.technicians t
      where t.id = j.technician_id
         or t.user_id = j.technician_id
    );

  if v_unmapped_count > 0 then
    raise exception using
      errcode = '23503',
      message = 'jobs technician migration blocked: unmapped technician_id values',
      detail = format('%s job row(s) require review', v_unmapped_count);
  end if;
end
$$;

-- 2) Backfill: jobs.technician_id currently equals technicians.user_id -> rewrite to technicians.id.
update public.jobs j
set
  technician_id = t.id,
  updated_at = coalesce(j.updated_at, now())
from public.technicians t
where j.technician_id is not null
  and t.user_id is not null
  and j.technician_id = t.user_id
  and not exists (
    select 1
    from public.technicians canonical
    where canonical.id = j.technician_id
  );

-- 3) Assert that the conversion produced only canonical technician IDs.
do $$
declare
  v_invalid_count bigint;
begin
  select count(*)
  into v_invalid_count
  from public.jobs j
  where j.technician_id is not null
    and not exists (
      select 1
      from public.technicians t
      where t.id = j.technician_id
    );

  if v_invalid_count > 0 then
    raise exception using
      errcode = '23503',
      message = 'jobs technician migration blocked: conversion did not produce canonical technician IDs',
      detail = format('%s job row(s) require review', v_invalid_count);
  end if;
end
$$;

-- 4) Enforce: add FK to technicians(id).
alter table public.jobs
  drop constraint if exists jobs_technician_id_fkey;

alter table public.jobs
  add constraint jobs_technician_id_fkey
  foreign key (technician_id)
  references public.technicians(id)
  on delete set null;

commit;


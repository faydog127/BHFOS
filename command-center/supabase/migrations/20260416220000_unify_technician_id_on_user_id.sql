-- Technician ID contract unification (Packet 005)
--
-- Canonical rule:
-- - jobs.technician_id stores technicians.user_id (NOT technicians.id)
-- - appointments.technician_id stores technicians.user_id (NOT technicians.id)
--
-- This migration is intentionally narrow:
-- - normalize existing rows where technician_id currently matches technicians.id
-- - switch appointments FK to reference technicians(user_id) so PostgREST joins remain valid

-- 1) Normalize jobs.technician_id values that currently store technicians.id.
update public.jobs as j
set
  technician_id = t.user_id,
  updated_at = coalesce(j.updated_at, now())
from public.technicians as t
where j.technician_id is not null
  and j.technician_id = t.id
  and t.user_id is not null;

-- 2) Normalize appointments.technician_id values that currently store technicians.id.
update public.appointments as a
set
  technician_id = t.user_id,
  updated_at = coalesce(a.updated_at, now())
from public.technicians as t
where a.technician_id is not null
  and a.technician_id = t.id
  and t.user_id is not null;

-- 3) Switch appointments FK to reference technicians(user_id).
-- (technicians.user_id is unique; nulls are allowed; unassigned appointments remain valid.)
alter table public.appointments
  drop constraint if exists appointments_technician_id_fkey;

alter table public.appointments
  add constraint appointments_technician_id_fkey
  foreign key (technician_id) references public.technicians(user_id) on delete set null;


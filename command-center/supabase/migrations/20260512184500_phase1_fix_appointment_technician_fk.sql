begin;

-- Phase 1 integrity blocker:
-- Standardize appointments.technician_id to reference technicians.id (not technicians.user_id).

-- Backfill existing rows that may have stored technicians.user_id into technician_id.
update public.appointments a
set technician_id = t.id
from public.technicians t
where a.technician_id is not null
  and t.user_id is not null
  and a.technician_id = t.user_id;

alter table public.appointments
  drop constraint if exists appointments_technician_id_fkey;

alter table public.appointments
  add constraint appointments_technician_id_fkey
  foreign key (technician_id)
  references public.technicians(id)
  on delete set null;

commit;


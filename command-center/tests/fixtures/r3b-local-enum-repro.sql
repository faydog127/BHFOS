-- Local-only: mirror production shape needed to prove the R3B trigger bug/fix.
-- Not a production migration. Safe to re-run.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_status') then
    create type public.appointment_status as enum (
      'pending',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
      'no_show',
      'rescheduled'
    );
  end if;
end $$;

-- Production has appointments.job_id (Packet 008). Local may lag.
alter table public.appointments
  add column if not exists job_id uuid references public.jobs(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'appointments_job_id_unique'
  ) then
    alter table public.appointments
      add constraint appointments_job_id_unique unique (job_id);
  end if;
end $$;

-- Drop status-dependent triggers so the column type can change.
drop trigger if exists trg_appointments_prevent_overlap on public.appointments;
drop trigger if exists trg_appointments_sync_job_schedule on public.appointments;
drop trigger if exists on_booking_verified on public.appointments;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'appointments'
      and column_name = 'status'
      and udt_name = 'text'
  ) then
    alter table public.appointments
      alter column status drop default,
      alter column status type public.appointment_status
        using lower(coalesce(status, 'pending'))::public.appointment_status,
      alter column status set default 'pending'::public.appointment_status;
  end if;
end $$;

-- Minimal stubs so triggers can be attached before the real migration body runs.
create or replace function public.appointments_prevent_overlap()
returns trigger
language plpgsql
as $$
begin
  return new;
end;
$$;

create or replace function public.sync_job_schedule_from_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  return new;
end;
$$;

create trigger trg_appointments_prevent_overlap
before insert or update of tenant_id, technician_id, scheduled_start, scheduled_end, status
on public.appointments
for each row
execute function public.appointments_prevent_overlap();

create trigger trg_appointments_sync_job_schedule
after insert or update of job_id, status, scheduled_start, scheduled_end, technician_id, service_address
on public.appointments
for each row
execute function public.sync_job_schedule_from_appointment();

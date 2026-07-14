-- Packet 008: Scheduling source-of-truth = appointments
-- Mirror: jobs.scheduled_* / technician_id / service_address

-- 1) Link appointments to jobs (optional; null means “booking-only / not yet a work order”).
alter table public.appointments
  add column if not exists job_id uuid references public.jobs(id) on delete set null;

-- At most one appointment record per job.
alter table public.appointments
  drop constraint if exists appointments_job_id_unique;

alter table public.appointments
  add constraint appointments_job_id_unique unique (job_id);

create index if not exists appointments_job_id_idx
  on public.appointments (job_id);

-- 2) Mirror appointment schedule → job schedule when job_id is set.
create or replace function public.sync_job_schedule_from_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_status text;
begin
  if new.job_id is null then
    return new;
  end if;

  -- Minimal status mapping:
  -- - confirmed/rescheduled implies scheduled if job is currently unscheduled-ish.
  -- - otherwise, do not override job status.
  if lower(coalesce(new.status, '')) in ('confirmed', 'rescheduled') then
    v_next_status := 'scheduled';
  else
    v_next_status := null;
  end if;

  update public.jobs as j
  set
    scheduled_start = coalesce(new.scheduled_start, j.scheduled_start),
    scheduled_end = coalesce(new.scheduled_end, j.scheduled_end),
    technician_id = coalesce(new.technician_id, j.technician_id),
    service_address = coalesce(nullif(new.service_address, ''), j.service_address),
    status = case
      when v_next_status is not null
        and lower(coalesce(j.status, '')) in ('unscheduled', 'pending_schedule')
        then v_next_status
      else j.status
    end,
    updated_at = now()
  where j.id = new.job_id
    and j.tenant_id = new.tenant_id;

  return new;
end;
$$;

drop trigger if exists trg_appointments_sync_job_schedule on public.appointments;

create trigger trg_appointments_sync_job_schedule
after insert or update of job_id, status, scheduled_start, scheduled_end, technician_id, service_address
on public.appointments
for each row
execute function public.sync_job_schedule_from_appointment();


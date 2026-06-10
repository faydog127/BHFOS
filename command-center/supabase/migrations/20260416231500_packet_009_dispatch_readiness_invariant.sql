-- Packet 009: Dispatch readiness invariant
-- Tighten appointment → job status promotion so jobs are not marked scheduled unless they are dispatchable.
--
-- Contract (v1):
-- - Dispatchable/scheduled work must have:
--   - scheduled_start
--   - scheduled_end
--   - technician_id (canonical = technicians.user_id)
--   - dispatchable service_address
--
-- Note: This keeps mirroring fields from appointments to jobs, but only promotes status to 'scheduled'
-- when the appointment has the required fields. This prevents silent drift where a job becomes scheduled
-- without technician assignment.

create or replace function public.sync_job_schedule_from_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_status text;
  v_ready boolean;
  v_addr text;
begin
  if new.job_id is null then
    return new;
  end if;

  v_addr := coalesce(nullif(btrim(new.service_address), ''), '');

  -- Conservative readiness check (server-side). UI/edge also enforces dispatchability.
  -- Address check is intentionally lightweight: we require non-empty and at least a comma plus a state token.
  v_ready :=
    new.scheduled_start is not null
    and new.scheduled_end is not null
    and new.technician_id is not null
    and v_addr <> ''
    and v_addr ~ ',\\s*[^,]+'
    and v_addr ~* '\\b[A-Z]{2}\\b';

  -- Minimal status mapping:
  -- - confirmed/rescheduled implies scheduled only if the appointment is dispatch-ready.
  -- - otherwise, do not override job status.
  if lower(coalesce(new.status, '')) in ('confirmed', 'rescheduled') and v_ready then
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


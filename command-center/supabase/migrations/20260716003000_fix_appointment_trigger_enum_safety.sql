-- R3B: Make appointment trigger status comparisons enum-safe.
--
-- Production `appointments.status` is `appointment_status` (enum). Two trigger
-- functions still used `coalesce(status, '')` / `coalesce(NEW.status, '')`.
-- PostgreSQL coerces the empty-string literal to the enum type and fails with:
--   invalid input value for enum appointment_status: ""
--
-- That blocked any write path that executes those expressions, including:
--   - UPDATE appointments.job_id          (AFTER sync trigger)
--   - UPDATE appointments.technician_id   (BEFORE overlap trigger)
--
-- Repair: cast status to text before coalesce/lower. Behavior of overlap
-- exclusion lists and confirmed/rescheduled → job scheduled promotion is
-- unchanged. No data backfill. No enum value changes. No trigger rewiring.

begin;

create or replace function public.appointments_prevent_overlap()
returns trigger
language plpgsql
as $$
declare
  conflict record;
  new_status text;
begin
  if new.tenant_id is null or new.technician_id is null then
    return new;
  end if;
  if new.scheduled_start is null or new.scheduled_end is null then
    return new;
  end if;
  if new.scheduled_end <= new.scheduled_start then
    return new;
  end if;

  -- Enum-safe: cast before coalesce so '' is never coerced to appointment_status.
  new_status := lower(coalesce(new.status::text, ''));
  if new_status in ('cancelled', 'canceled', 'completed', 'no_show', 'noshow') then
    return new;
  end if;

  select a.id, a.scheduled_start, a.scheduled_end, a.status
    into conflict
  from public.appointments a
  where a.tenant_id = new.tenant_id
    and a.technician_id = new.technician_id
    and lower(coalesce(a.status::text, '')) not in ('cancelled', 'canceled', 'completed', 'no_show', 'noshow')
    and a.scheduled_start < new.scheduled_end
    and a.scheduled_end > new.scheduled_start
    and (tg_op <> 'UPDATE' or a.id <> new.id)
  order by a.scheduled_start asc
  limit 1;

  if conflict.id is not null then
    raise exception using
      errcode = 'P0001',
      message = format('Scheduling conflict with appointment %s (%s - %s).',
        conflict.id,
        conflict.scheduled_start,
        conflict.scheduled_end
      );
  end if;

  return new;
end;
$$;

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

  -- Minimal status mapping (enum-safe text compare):
  -- - confirmed/rescheduled implies scheduled only if the appointment is dispatch-ready.
  -- - otherwise, do not override job status.
  if lower(coalesce(new.status::text, '')) in ('confirmed', 'rescheduled') and v_ready then
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

commit;

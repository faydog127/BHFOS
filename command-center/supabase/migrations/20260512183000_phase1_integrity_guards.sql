begin;

-- Phase 1 integrity guards:
-- 1) Canonical quote "won" status: accepted (normalize legacy approved/won).
-- 2) Server-side overlap protection for dispatch scheduling (jobs) + appointments.

-- -----------------------------
-- 1) Quote status normalization
-- -----------------------------

update public.quotes
set
  status = 'accepted',
  accepted_at = coalesce(accepted_at, updated_at, created_at, now()),
  updated_at = now()
where lower(coalesce(status, '')) in ('approved', 'won');

create or replace function public.normalize_quote_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is null then
    return new;
  end if;

  if lower(new.status) in ('approved', 'won') then
    new.status := 'accepted';
    if new.accepted_at is null then
      new.accepted_at := coalesce(new.updated_at, new.created_at, now());
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_quote_status on public.quotes;
create trigger trg_normalize_quote_status
before insert or update of status
on public.quotes
for each row
execute function public.normalize_quote_status();

-- ------------------------------------------------
-- 2) Overlap protection for technician scheduling
-- ------------------------------------------------
-- Goal: prevent double-booking even if a client bypasses UI-only checks.
-- This does not back-validate existing data; it only blocks new/updated overlaps.

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

  new_status := lower(coalesce(new.status, ''));
  if new_status in ('cancelled', 'canceled', 'completed', 'no_show', 'noshow') then
    return new;
  end if;

  select a.id, a.scheduled_start, a.scheduled_end, a.status
    into conflict
  from public.appointments a
  where a.tenant_id = new.tenant_id
    and a.technician_id = new.technician_id
    and lower(coalesce(a.status, '')) not in ('cancelled', 'canceled', 'completed', 'no_show', 'noshow')
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

drop trigger if exists trg_appointments_prevent_overlap on public.appointments;
create trigger trg_appointments_prevent_overlap
before insert or update of tenant_id, technician_id, scheduled_start, scheduled_end, status
on public.appointments
for each row
execute function public.appointments_prevent_overlap();

create or replace function public.jobs_prevent_overlap()
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

  new_status := lower(coalesce(new.status, ''));
  if new_status not in ('scheduled', 'en_route', 'in_progress') then
    return new;
  end if;

  select j.id, j.status, j.scheduled_start, j.scheduled_end
    into conflict
  from public.jobs j
  where j.tenant_id = new.tenant_id
    and j.technician_id = new.technician_id
    and lower(coalesce(j.status, '')) in ('scheduled', 'en_route', 'in_progress')
    and j.scheduled_start < new.scheduled_end
    and j.scheduled_end > new.scheduled_start
    and (tg_op <> 'UPDATE' or j.id <> new.id)
  order by j.scheduled_start asc
  limit 1;

  if conflict.id is not null then
    raise exception using
      errcode = 'P0001',
      message = format('Scheduling conflict with work order %s (%s - %s).',
        conflict.id,
        conflict.scheduled_start,
        conflict.scheduled_end
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jobs_prevent_overlap on public.jobs;
create trigger trg_jobs_prevent_overlap
before insert or update of tenant_id, technician_id, scheduled_start, scheduled_end, status
on public.jobs
for each row
execute function public.jobs_prevent_overlap();

commit;

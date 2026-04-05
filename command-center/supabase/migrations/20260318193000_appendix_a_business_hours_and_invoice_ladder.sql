-- Appendix A automation timing hardening
-- Adds a canonical DB-side business-hours normalizer for follow-up tasks

-- Ensure tenant_id exists on crm_tasks before using it.
alter table if exists public.crm_tasks
  add column if not exists tenant_id text;

create or replace function public.normalize_business_due_at(
  p_tenant_id text,
  p_base_at timestamptz default now()
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timezone text := 'America/New_York';
  v_hours jsonb := '{
    "monday": {"isOpen": true, "start": "09:00", "end": "17:00"},
    "tuesday": {"isOpen": true, "start": "09:00", "end": "17:00"},
    "wednesday": {"isOpen": true, "start": "09:00", "end": "17:00"},
    "thursday": {"isOpen": true, "start": "09:00", "end": "17:00"},
    "friday": {"isOpen": true, "start": "09:00", "end": "17:00"},
    "saturday": {"isOpen": false, "start": "10:00", "end": "14:00"},
    "sunday": {"isOpen": false, "start": "10:00", "end": "14:00"}
  }'::jsonb;
  v_local_ts timestamp;
  v_candidate_date date;
  v_day_key text;
  v_day_hours jsonb;
  v_is_open boolean;
  v_start_at time;
  v_end_at time;
  v_minutes integer;
  v_has_tenant boolean;
  i integer;
begin
  if to_regclass('public.business_settings') is not null then
    v_has_tenant := exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'business_settings'
        and column_name = 'tenant_id'
    );

    if v_has_tenant then
      select
        coalesce(time_zone, v_timezone),
        coalesce(operating_hours, v_hours)
      into v_timezone, v_hours
      from public.business_settings
      where tenant_id = p_tenant_id
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1;
    else
      select
        coalesce(time_zone, v_timezone),
        coalesce(operating_hours, v_hours)
      into v_timezone, v_hours
      from public.business_settings
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1;
    end if;
  end if;

  v_local_ts := coalesce(p_base_at, now()) at time zone v_timezone;

  for i in 0..14 loop
    v_candidate_date := (v_local_ts::date + i);
    v_day_key := lower(trim(to_char(v_candidate_date, 'FMDay')));
    v_day_hours := coalesce(v_hours -> v_day_key, '{}'::jsonb);
    v_is_open := coalesce((v_day_hours ->> 'isOpen')::boolean, false);

    if not v_is_open then
      continue;
    end if;

    v_start_at := ((coalesce(v_day_hours ->> 'start', '09:00'))::time + interval '1 minute')::time;
    v_end_at := coalesce(v_day_hours ->> 'end', '17:00')::time;

    if i = 0 then
      v_minutes := extract(hour from v_local_ts)::int * 60 + extract(minute from v_local_ts)::int;
      if v_minutes >= extract(hour from v_start_at)::int * 60 + extract(minute from v_start_at)::int
        and v_minutes < extract(hour from v_end_at)::int * 60 + extract(minute from v_end_at)::int then
        return coalesce(p_base_at, now());
      end if;

      if v_minutes < extract(hour from v_start_at)::int * 60 + extract(minute from v_start_at)::int then
        return make_timestamptz(
          extract(year from v_candidate_date)::int,
          extract(month from v_candidate_date)::int,
          extract(day from v_candidate_date)::int,
          extract(hour from v_start_at)::int,
          extract(minute from v_start_at)::int,
          0,
          v_timezone
        );
      end if;

      continue;
    end if;

    return make_timestamptz(
      extract(year from v_candidate_date)::int,
      extract(month from v_candidate_date)::int,
      extract(day from v_candidate_date)::int,
      extract(hour from v_start_at)::int,
      extract(minute from v_start_at)::int,
      0,
      v_timezone
    );
  end loop;

  return coalesce(p_base_at, now());
end;
$$;

create or replace function public.ensure_follow_up_task(
  p_tenant_id text,
  p_source_type text,
  p_source_id uuid,
  p_lead_id uuid,
  p_title text,
  p_due_at timestamptz default null,
  p_priority text default 'medium',
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due_at timestamptz;
begin
  if p_tenant_id is null or p_source_type is null or p_source_id is null or p_title is null then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'crm_tasks'
      and column_name = 'tenant_id'
  ) then
    return;
  end if;

  v_due_at := public.normalize_business_due_at(p_tenant_id, coalesce(p_due_at, now()));

  update public.crm_tasks
  set
    due_at = v_due_at,
    priority = coalesce(p_priority, priority),
    notes = coalesce(p_notes, notes),
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
    updated_at = now()
  where tenant_id = p_tenant_id
    and type = 'follow_up'
    and source_type = p_source_type
    and source_id = p_source_id
    and title = p_title
    and status in ('open', 'new', 'pending', 'PENDING', 'in-progress');

  if found then
    return;
  end if;

  insert into public.crm_tasks (
    tenant_id,
    lead_id,
    source_type,
    source_id,
    type,
    title,
    status,
    due_at,
    priority,
    notes,
    metadata,
    created_at,
    updated_at
  ) values (
    p_tenant_id,
    p_lead_id,
    p_source_type,
    p_source_id,
    'follow_up',
    p_title,
    'open',
    v_due_at,
    p_priority,
    p_notes,
    coalesce(p_metadata, '{}'::jsonb),
    now(),
    now()
  );
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'crm_tasks'
      and column_name = 'tenant_id'
  ) then
    execute $sql$
      update public.crm_tasks
      set
        due_at = public.normalize_business_due_at(tenant_id, coalesce(created_at, now())),
        updated_at = now()
      where type = 'follow_up'
        and status in ('open', 'new', 'pending', 'PENDING', 'in-progress')
        and due_at is null
    $sql$;
  end if;
end $$;

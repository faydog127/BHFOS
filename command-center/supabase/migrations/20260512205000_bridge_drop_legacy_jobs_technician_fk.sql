begin;

-- Production compatibility bridge:
-- The hosted jobs.technician_id FK still references auth.users(id), while the
-- next migration converts stored technicians.user_id values to technicians.id.
-- Drop only that verified legacy shape before the data conversion runs.
do $$
declare
  v_constraint record;
begin
  select
    c.contype,
    array_length(c.conkey, 1) as local_column_count,
    array_length(c.confkey, 1) as referenced_column_count,
    local_att.attname as local_column,
    ref_ns.nspname as referenced_schema,
    ref_rel.relname as referenced_table,
    ref_att.attname as referenced_column,
    pg_get_constraintdef(c.oid) as definition
  into v_constraint
  from pg_constraint c
  join pg_class local_rel on local_rel.oid = c.conrelid
  join pg_namespace local_ns on local_ns.oid = local_rel.relnamespace
  join unnest(c.conkey) with ordinality local_key(attnum, ordinality) on true
  join pg_attribute local_att
    on local_att.attrelid = local_rel.oid
   and local_att.attnum = local_key.attnum
  join pg_class ref_rel on ref_rel.oid = c.confrelid
  join pg_namespace ref_ns on ref_ns.oid = ref_rel.relnamespace
  join unnest(c.confkey) with ordinality ref_key(attnum, ordinality)
    on ref_key.ordinality = local_key.ordinality
  join pg_attribute ref_att
    on ref_att.attrelid = ref_rel.oid
   and ref_att.attnum = ref_key.attnum
  where local_ns.nspname = 'public'
    and local_rel.relname = 'jobs'
    and c.conname = 'jobs_technician_id_fkey';

  -- Fresh databases have no jobs technician FK at this point.
  if not found then
    return;
  end if;

  if v_constraint.contype <> 'f'
     or v_constraint.local_column_count <> 1
     or v_constraint.referenced_column_count <> 1
     or v_constraint.local_column <> 'technician_id' then
    raise exception using
      errcode = '55000',
      message = 'jobs technician FK bridge blocked: unexpected constraint shape',
      detail = v_constraint.definition;
  end if;

  if v_constraint.referenced_schema = 'auth'
     and v_constraint.referenced_table = 'users'
     and v_constraint.referenced_column = 'id' then
    alter table public.jobs
      drop constraint jobs_technician_id_fkey;
    return;
  end if;

  -- Idempotent no-op if the canonical FK was already installed out of band.
  if v_constraint.referenced_schema = 'public'
     and v_constraint.referenced_table = 'technicians'
     and v_constraint.referenced_column = 'id' then
    return;
  end if;

  raise exception using
    errcode = '55000',
    message = 'jobs technician FK bridge blocked: unexpected referenced target',
    detail = v_constraint.definition;
end
$$;

commit;

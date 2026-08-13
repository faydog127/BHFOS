/**
 * R3B — appointment trigger enum-safety (local Postgres).
 *
 * Proves coalesce(status, '') fails against appointment_status, that the
 * migration repair allows job_id / technician_id writes, and that overlap +
 * job sync behavior remain intact.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isJobScheduleLockedByAppointment,
  omitLockedScheduleFields,
  JOB_SCHEDULE_LINKED_MESSAGE,
} from '../../src/lib/jobAppointmentSchedule.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const dbUrl = process.env.SUPABASE_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:25432/postgres';
const migrationPath = path.join(
  root,
  'supabase/migrations/20260716003000_fix_appointment_trigger_enum_safety.sql',
);
const marker = `R3B ENUM ${Date.now().toString(36)}`;
const psql = (sql, { stopOnError = true } = {}) => {
  const args = [
    dbUrl,
    '-q',
    '-v',
    `ON_ERROR_STOP=${stopOnError ? '1' : '0'}`,
    '-t',
    '-A',
    '-c',
    sql,
  ];
  const res = spawnSync('psql', args, {
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || 'postgres' },
  });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').trim();
    const error = new Error(err || `psql exit ${res.status}`);
    error.stderr = res.stderr;
    error.stdout = res.stdout;
    throw error;
  }
  return (res.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^INSERT\b|^UPDATE\b|^DELETE\b/i.test(line))[0] || '';
};

const psqlFile = (filePath) => {
  const res = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', filePath], {
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || 'postgres' },
  });
  if (res.status !== 0) {
    throw new Error((res.stderr || res.stdout || '').trim() || `psql -f exit ${res.status}`);
  }
  return res.stdout;
};

const ensureEnumType = () => {
  psql(`
    do $$
    begin
      if not exists (select 1 from pg_type where typname = 'appointment_status') then
        create type public.appointment_status as enum (
          'pending','confirmed','in_progress','completed','cancelled','no_show','rescheduled'
        );
      end if;
    end $$;
  `);
};

const installUnsafeFunctions = () => {
  // Exact unsafe coalesce pattern from production (pre-repair).
  psql(`
    create or replace function public.appointments_prevent_overlap()
    returns trigger language plpgsql as $$
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
            conflict.id, conflict.scheduled_start, conflict.scheduled_end);
      end if;
      return new;
    end;
    $$;
  `);
  psql(`
    create or replace function public.sync_job_schedule_from_appointment()
    returns trigger language plpgsql security definer set search_path = public as $$
    begin
      if new.job_id is null then
        return new;
      end if;
      if lower(coalesce(new.status, '')) in ('confirmed', 'rescheduled') then
        null;
      end if;
      return new;
    end;
    $$;
  `);
};

const ensureLocalEnumMirror = () => {
  psqlFile(path.join(root, 'tests/fixtures/r3b-local-enum-repro.sql'));
};

const applyMigration = () => {
  assert.ok(fs.existsSync(migrationPath), 'migration file missing');
  psqlFile(migrationPath);
};

const cleanup = (ids) => {
  if (ids.apptIds?.length) {
    psql(`delete from public.appointments where id in (${ids.apptIds.map((id) => `'${id}'`).join(',')});`, {
      stopOnError: false,
    });
  }
  if (ids.jobIds?.length) {
    psql(`delete from public.jobs where id in (${ids.jobIds.map((id) => `'${id}'`).join(',')});`, {
      stopOnError: false,
    });
  }
  if (ids.leadId) {
    psql(`delete from public.leads where id = '${ids.leadId}';`, { stopOnError: false });
  }
  if (ids.techIds?.length) {
    psql(`delete from public.technicians where id in (${ids.techIds.map((id) => `'${id}'`).join(',')});`, {
      stopOnError: false,
    });
  }
};

const seed = () => {
  const techA = psql(`
    insert into public.technicians (full_name, is_active)
    values ('${marker} TECH A', true)
    returning id;
  `);
  const techB = psql(`
    insert into public.technicians (full_name, is_active)
    values ('${marker} TECH B', true)
    returning id;
  `);
  const leadId = psql(`
    insert into public.leads (
      tenant_id, first_name, last_name, phone, address, source, status, stage
    ) values (
      'tvg', '${marker}', 'Customer', '(555) 010-2222', '1 Test St', 'r3b_test', 'new', 'new'
    ) returning id;
  `);
  const start1 = '2099-08-01T14:00:00Z';
  const end1 = '2099-08-01T15:00:00Z';
  const start2 = '2099-08-01T14:30:00Z';
  const end2 = '2099-08-01T15:30:00Z';
  const jobId = psql(`
    insert into public.jobs (
      tenant_id, lead_id, technician_id, status, payment_status,
      service_address, work_order_number
    ) values (
      'tvg', '${leadId}', '${techA}', 'unscheduled', 'unpaid',
      '100 Enum Safe Ave, Titusville, FL 32780', 'R3B-${Date.now().toString(36)}'
    ) returning id;
  `);
  return {
    techA,
    techB,
    leadId,
    jobId,
    start1,
    end1,
    start2,
    end2,
    techIds: [techA, techB],
    jobIds: [jobId],
    apptIds: [],
  };
};

const localDbAvailable = (() => {
  try {
    return psql('select 1') === '1';
  } catch {
    return false;
  }
})();

test('local db reachable (or skip when no local Postgres)', { skip: !localDbAvailable }, () => {
  assert.equal(psql('select 1'), '1');
});

test('root cause: coalesce(enum, empty string) fails', { skip: !localDbAvailable }, () => {
  ensureEnumType();
  let failed = false;
  try {
    psql(`
      do $$
      declare s public.appointment_status := 'confirmed';
      begin
        perform lower(coalesce(s, ''));
      end $$;
    `);
  } catch (error) {
    failed = true;
    assert.match(String(error.message), /appointment_status|invalid input value/i);
  }
  assert.equal(failed, true, 'expected enum coercion failure');
});

test('root cause: coalesce(enum::text, empty string) succeeds', { skip: !localDbAvailable }, () => {
  ensureEnumType();
  psql(`
    do $$
    declare s public.appointment_status := 'confirmed';
    begin
      perform lower(coalesce(s::text, ''));
    end $$;
  `);
});

test('unsafe triggers block job_id and technician_id; migration unblocks them', { skip: !localDbAvailable }, async () => {
  ensureLocalEnumMirror();
  installUnsafeFunctions();

  const ids = seed();
  try {
    const apptId = psql(`
      insert into public.appointments (
        tenant_id, lead_id, scheduled_start, scheduled_end, status, service_name, service_address
      ) values (
        'tvg', '${ids.leadId}', '${ids.start1}', '${ids.end1}', 'confirmed',
        'R3B Visit', '100 Enum Safe Ave, Titusville, FL 32780'
      ) returning id;
    `);
    ids.apptIds.push(apptId);

    let jobLinkFailed = false;
    try {
      psql(`update public.appointments set job_id = '${ids.jobId}' where id = '${apptId}';`);
    } catch (error) {
      jobLinkFailed = true;
      assert.match(String(error.message), /appointment_status|invalid input value/i);
    }
    assert.equal(jobLinkFailed, true, 'unsafe sync should block job_id update');

    let techFailed = false;
    try {
      psql(`update public.appointments set technician_id = '${ids.techA}' where id = '${apptId}';`);
    } catch (error) {
      techFailed = true;
      assert.match(String(error.message), /appointment_status|invalid input value/i);
    }
    assert.equal(techFailed, true, 'unsafe overlap should block technician_id update');

    // Apply repair migration
    applyMigration();

    // INSERT with valid status still works
    const appt2 = psql(`
      insert into public.appointments (
        tenant_id, lead_id, scheduled_start, scheduled_end, status, service_name, service_address
      ) values (
        'tvg', '${ids.leadId}', '2099-08-03T14:00:00Z', '2099-08-03T15:00:00Z', 'confirmed',
        'R3B Visit 2', '104 Enum Safe Ave, Titusville, FL 32780'
      ) returning id;
    `);
    ids.apptIds.push(appt2);

    // Default status
    const apptDefault = psql(`
      insert into public.appointments (
        tenant_id, lead_id, scheduled_start, scheduled_end, service_name, service_address
      ) values (
        'tvg', '${ids.leadId}', '2099-08-04T14:00:00Z', '2099-08-04T15:00:00Z',
        'R3B Default', '105 Enum Safe Ave, Titusville, FL 32780'
      ) returning id;
    `);
    ids.apptIds.push(apptDefault);
    assert.equal(psql(`select status::text from public.appointments where id = '${apptDefault}';`), 'pending');

    // job_id + technician_id succeed after repair
    psql(`update public.appointments set job_id = '${ids.jobId}' where id = '${apptId}';`);
    psql(`update public.appointments set technician_id = '${ids.techA}' where id = '${apptId}';`);
    psql(`
      update public.appointments
      set job_id = '${ids.jobId}',
          technician_id = '${ids.techA}',
          service_address = '100 Enum Safe Ave, Titusville, FL 32780'
      where id = '${apptId}';
    `);
    assert.equal(psql(`select job_id from public.appointments where id = '${apptId}';`), ids.jobId);
    assert.equal(psql(`select technician_id from public.appointments where id = '${apptId}';`), ids.techA);

    // Unrelated field
    psql(`update public.appointments set service_name = 'R3B Visit Updated' where id = '${apptId}';`);
    assert.equal(psql(`select service_name from public.appointments where id = '${apptId}';`), 'R3B Visit Updated');

    // Overlap still blocked
    let overlapBlocked = false;
    try {
      const overlapId = psql(`
        insert into public.appointments (
          tenant_id, lead_id, technician_id, scheduled_start, scheduled_end, status, service_name, service_address
        ) values (
          'tvg', '${ids.leadId}', '${ids.techA}', '${ids.start2}', '${ids.end2}', 'confirmed',
          'R3B Overlap', '102 Enum Safe Ave, Titusville, FL 32780'
        ) returning id;
      `);
      ids.apptIds.push(overlapId);
    } catch (error) {
      overlapBlocked = true;
      assert.match(String(error.message), /Scheduling conflict/i);
    }
    assert.equal(overlapBlocked, true);

    // Cancelled excluded from overlap
    const cancelledId = psql(`
      insert into public.appointments (
        tenant_id, lead_id, technician_id, scheduled_start, scheduled_end, status, service_name, service_address
      ) values (
        'tvg', '${ids.leadId}', '${ids.techA}', '${ids.start2}', '${ids.end2}', 'cancelled',
        'R3B Cancelled', '103 Enum Safe Ave, Titusville, FL 32780'
      ) returning id;
    `);
    ids.apptIds.push(cancelledId);

    // Job sync still mirrors schedule fields (Packet 009 readiness regex is unchanged;
    // status promotion only when v_ready — assert field sync, not promotion).
    assert.equal(
      psql(`select technician_id from public.jobs where id = '${ids.jobId}';`),
      ids.techA,
    );
    assert.equal(
      psql(`select scheduled_start = '${ids.start1}'::timestamptz from public.jobs where id = '${ids.jobId}';`),
      't',
    );
    assert.match(
      psql(`select service_address from public.jobs where id = '${ids.jobId}';`),
      /Enum Safe Ave/,
    );

    // No empty status strings
    assert.equal(
      psql(`
        select count(*)::text from public.appointments
        where id in (${ids.apptIds.map((id) => `'${id}'`).join(',')})
          and status::text = '';
      `),
      '0',
    );

    // Invalid enum rejected
    let invalidRejected = false;
    try {
      psql(`update public.appointments set status = 'not_a_real_status' where id = '${apptId}';`);
    } catch (error) {
      invalidRejected = true;
      assert.match(String(error.message), /invalid input value for enum appointment_status/i);
    }
    assert.equal(invalidRejected, true);

    // R3 helper contract unchanged (link shape from DB)
    const linkedRow = {
      id: apptId,
      job_id: ids.jobId,
    };
    assert.equal(isJobScheduleLockedByAppointment(linkedRow), true);
    assert.equal(isJobScheduleLockedByAppointment(null), false);
    assert.match(JOB_SCHEDULE_LINKED_MESSAGE, /Calendar/);
    const stripped = omitLockedScheduleFields({
      scheduled_start: 'x',
      technician_id: 'y',
      service_address: 'z',
      notes: 'keep',
    });
    assert.equal(stripped.notes, 'keep');
    assert.equal(stripped.scheduled_start, undefined);
    assert.equal(
      psql(`select count(*)::text from public.appointments where job_id = '${ids.jobId}';`),
      '1',
    );
  } finally {
    cleanup(ids);
  }
});

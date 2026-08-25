/**
 * NOS-CONVENTION-WRITE-PATH-FOUNDER-GATE-01 v2 Option A
 * Local sequence M1 + T1–T11. Synthetic data only.
 * Run: node --test tests/unit/network-os-convention-write-path.test.mjs
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  createProviderInterestIntakeHandler,
  intakeLogContainsSensitive,
  PAYLOAD_CEILING_BYTES,
} from '../../supabase/functions/network-os-provider-interest-intake/handler.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PG_BIN = process.env.CONVENTION_INTAKE_PGBIN || '/usr/lib/postgresql/16/bin';
const PGDATA = process.env.CONVENTION_INTAKE_PGDATA || '/tmp/convention-intake-pg';
const PGPORT = process.env.CONVENTION_INTAKE_PGPORT || '55432';
const PGHOST = '127.0.0.1';
const PGUSER = 'ubuntu';
const DB_NAME = 'convention_intake_local';
const ORIGIN = 'https://convention.example.invalid';

const SYNTH = Object.freeze({
  name: 'Alex Rivera',
  company: 'Rivera Mechanical',
  email: 'alex.rivera@example.invalid',
  phone: '3215550100',
  trades: ['HVAC'],
  service_area: 'Brevard County',
  consent: true,
  client_request_id: 'synth-req-1',
});

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const BHIS_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';

function pgBin(name) {
  return path.join(PG_BIN, name);
}

function ensurePostgres() {
  const ready = spawnSync(pgBin('pg_isready'), ['-h', PGHOST, '-p', PGPORT, '-U', PGUSER], {
    encoding: 'utf8',
  });
  if (ready.status === 0) return;
  if (!fs.existsSync(path.join(PGDATA, 'PG_VERSION'))) {
    const init = spawnSync(
      pgBin('initdb'),
      ['-D', PGDATA, '--auth-local=trust', '--auth-host=trust', `--username=${PGUSER}`, '--no-instructions'],
      { encoding: 'utf8' },
    );
    if (init.status !== 0) {
      throw new Error(`initdb failed: ${init.stderr || init.stdout}`);
    }
  }
  const start = spawnSync(
    pgBin('pg_ctl'),
    ['-D', PGDATA, '-l', '/tmp/convention-intake-pg.log', '-o', `-p ${PGPORT} -k /tmp`, 'start'],
    { encoding: 'utf8' },
  );
  if (start.status !== 0 && !/already running/i.test(`${start.stderr}${start.stdout}`)) {
    throw new Error(`pg_ctl start failed: ${start.stderr || start.stdout}`);
  }
}

function psqlLast(sql, db = DB_NAME) {
  const out = psql(sql, db);
  const lines = out.split('\n').filter(Boolean);
  return lines[lines.length - 1] || '';
}

function psql(sql, db = DB_NAME) {
  const result = spawnSync(
    pgBin('psql'),
    ['-h', PGHOST, '-p', PGPORT, '-U', PGUSER, '-d', db, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-c', sql],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    const err = new Error(result.stderr || result.stdout || 'psql failed');
    err.stderr = result.stderr;
    err.stdout = result.stdout;
    throw err;
  }
  return (result.stdout || '').trim();
}

function psqlFile(file, db = DB_NAME) {
  const result = spawnSync(
    pgBin('psql'),
    ['-h', PGHOST, '-p', PGPORT, '-U', PGUSER, '-d', db, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-f', file],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`${file}: ${result.stderr || result.stdout || 'psql failed'}`);
  }
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (Array.isArray(value)) return `ARRAY[${value.map(sqlLiteral).join(',')}]::text[]`;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function insertAsServiceRole(row) {
  const sql = `
    SET ROLE service_role;
    INSERT INTO public.network_os_provider_interest_intake (
      campaign_id, source, intake_channel, onboarding_status,
      display_name, company_name, email, phone_digits, trades,
      service_area, consent_contact, consented_at, submitted_at,
      client_request_id, is_test_data
    ) VALUES (
      ${sqlLiteral(row.campaign_id)},
      ${sqlLiteral(row.source)},
      ${sqlLiteral(row.intake_channel)},
      ${sqlLiteral(row.onboarding_status)},
      ${sqlLiteral(row.display_name)},
      ${sqlLiteral(row.company_name)},
      ${sqlLiteral(row.email)},
      ${sqlLiteral(row.phone_digits)},
      ${sqlLiteral(row.trades)},
      ${sqlLiteral(row.service_area)},
      ${sqlLiteral(row.consent_contact)},
      ${sqlLiteral(row.consented_at)}::timestamptz,
      ${sqlLiteral(row.submitted_at)}::timestamptz,
      ${sqlLiteral(row.client_request_id)},
      ${sqlLiteral(row.is_test_data)}
    );
    RESET ROLE;
  `;
  try {
    psql(sql);
    return { ok: true };
  } catch (error) {
    const text = `${error.stderr || ''} ${error.message || ''}`;
    if (text.includes('23505') || /duplicate key|unique constraint/i.test(text)) {
      return { ok: false, duplicate: true };
    }
    return { ok: false };
  }
}

async function postIntake(handle, body, { origin = ORIGIN, extraHeaders = {}, raw } = {}) {
  const payload = raw === undefined ? JSON.stringify(body) : raw;
  const req = new Request('https://functions.example.invalid/network-os-provider-interest-intake', {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      ...extraHeaders,
    },
    body: payload,
  });
  const res = await handle(req);
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json, headers: res.headers };
}

describe('convention write path local sequence', { concurrency: 1 }, () => {
  it('proves M1 and T1 through T11 on a disposable local database', async () => {
    ensurePostgres();
    psql(`DROP DATABASE IF EXISTS ${DB_NAME};`, 'postgres');
    psql(`CREATE DATABASE ${DB_NAME};`, 'postgres');
    psqlFile(path.join(root, 'supabase/tests/convention-intake/local_harness.sql'));

    const customerSnapshotSql = `
      SELECT json_build_object(
        'leads', (SELECT count(*) FROM public.leads),
        'contacts', (SELECT count(*) FROM public.contacts),
        'events', (SELECT count(*) FROM public.events),
        'lead_cols', (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='leads'),
        'contact_cols', (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts')
      );
    `;
    const customerBefore = psql(customerSnapshotSql);

    psqlFile(path.join(root, 'supabase/migrations/20260824154100_network_os_provider_interest_intake.sql'));

    const objects = psql(`
      SELECT json_build_object(
        'table', EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='network_os_provider_interest_intake'
        ),
        'helper', EXISTS (
          SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname='public' AND p.proname='network_os_actor_has_bhis_convention_intake'
            AND p.pronargs=0
        ),
        'tenant_id', EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='network_os_provider_interest_intake'
            AND column_name='tenant_id'
        ),
        'duplicate_key', EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='network_os_provider_interest_intake'
            AND column_name='duplicate_key'
        )
      );
    `);
    const objectState = JSON.parse(objects);
    assert.equal(objectState.table, true);
    assert.equal(objectState.helper, true);
    assert.equal(objectState.tenant_id, false);
    assert.equal(objectState.duplicate_key, false);
    assert.equal(psql(`SELECT count(*) FROM public.leads`), '0');
    assert.equal(psql(`SELECT count(*) FROM public.contacts`), '0');
    assert.equal(psql(customerSnapshotSql), customerBefore);
    // M1 pass

    const logs = [];
    let now = Date.parse('2026-08-24T12:00:00.000Z');
    const handle = createProviderInterestIntakeHandler({
      allowedOrigins: [ORIGIN],
      insertRow: insertAsServiceRole,
      now: () => now,
      requestId: () => 'req-local-1',
      remoteAddress: () => '203.0.113.10',
      log: (event) => logs.push(event),
    });

    const t1 = await postIntake(handle, SYNTH);
    assert.equal(t1.status, 200);
    assert.deepEqual(t1.json, { ok: true, received: true, stored: true, duplicate: false });
    const t1Row = JSON.parse(psql(`
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT campaign_id, source, intake_channel, onboarding_status,
               email, phone_digits, is_test_data,
               consented_at IS NOT NULL AS consented_set,
               submitted_at IS NOT NULL AS submitted_set
        FROM public.network_os_provider_interest_intake
      ) t;
    `));
    assert.equal(t1Row.length, 1);
    assert.equal(t1Row[0].campaign_id, 'HUGE_2026');
    assert.equal(t1Row[0].source, 'HUGE_2026');
    assert.equal(t1Row[0].intake_channel, 'convention_qr');
    assert.equal(t1Row[0].onboarding_status, 'provider_interest_received');
    assert.equal(t1Row[0].is_test_data, true);
    assert.equal(t1Row[0].consented_set, true);
    assert.equal(t1Row[0].submitted_set, true);
    // T1 pass

    now += 10_000;
    const t2 = await postIntake(handle, { ...SYNTH, client_request_id: 'synth-req-2' });
    assert.equal(t2.json.duplicate, true);
    assert.equal(t2.json.stored, false);
    assert.equal(t2.json.received, true);
    assert.equal(psql('SELECT count(*) FROM public.network_os_provider_interest_intake'), '1');
    // T2 pass

    now += 10_000;
    const t3 = await postIntake(handle, {
      ...SYNTH,
      email: 'other.rivera@example.invalid',
      client_request_id: 'synth-req-3',
    });
    assert.equal(t3.json.duplicate, true);
    assert.equal(psql('SELECT count(*) FROM public.network_os_provider_interest_intake'), '1');
    // T3 pass

    now += 10_000;
    const t4 = await postIntake(handle, {
      name: 'SYNTH Other',
      company: 'Other Mechanical',
      email: 'other.unique@example.invalid',
      phone: '3215550199',
      trades: ['Plumbing'],
      service_area: 'Orange County',
      consent: true,
      client_request_id: 'synth-req-1',
    });
    assert.equal(t4.json.duplicate, true);
    assert.equal(psql('SELECT count(*) FROM public.network_os_provider_interest_intake'), '1');
    // T4 pass

    now += 10_000;
    const t5validation = await postIntake(handle, { name: 'Only' });
    assert.equal(t5validation.json.error.code, 'CONVENTION_INTAKE_VALIDATION');
    now += 10_000;
    const t5honeypot = await postIntake(handle, { ...SYNTH, honeypot: 'http://spam.test', client_request_id: 'hp-1' });
    assert.equal(t5honeypot.json.received, true);
    assert.equal(t5honeypot.json.stored, false);
    assert.equal(t5honeypot.json.duplicate, false);
    assert.equal(t5honeypot.json.error, undefined);
    now += 10_000;
    const t5extra = await postIntake(handle, {
      ...SYNTH,
      client_request_id: 'extra-1',
      source: 'leads',
      tenant_id: 'tvg',
      campaign_id: 'other',
    });
    assert.equal(t5extra.json.duplicate, true);
    now += 10_000;
    const forbidden = await postIntake(handle, {
      name: 'SYNTH Tenant',
      company: 'Forge',
      email: 'synth.unique@example.invalid',
      phone: '4075550100',
      trades: ['Electrical'],
      service_area: 'Osceola County',
      consent: true,
      client_request_id: 'client-source-1',
      source: 'convention_qr',
      tenant_id: 'tvg',
    });
    assert.equal(forbidden.json.stored, true);
    assert.equal(
      psql(`SELECT source FROM public.network_os_provider_interest_intake WHERE email='synth.unique@example.invalid'`),
      'HUGE_2026',
    );
    assert.equal(
      psql(`SELECT intake_channel FROM public.network_os_provider_interest_intake WHERE email='synth.unique@example.invalid'`),
      'convention_qr',
    );
    assert.equal(psql('SELECT count(*) FROM public.leads'), '0');
    assert.equal(psql('SELECT count(*) FROM public.contacts'), '0');
    // T5 pass — extra keys / client source cannot create unauthorized rows

    const t6 = JSON.parse(psql(`
      SELECT json_build_object(
        'select_denied', NOT has_table_privilege('anon', 'public.network_os_provider_interest_intake', 'SELECT'),
        'insert_denied', NOT has_table_privilege('anon', 'public.network_os_provider_interest_intake', 'INSERT'),
        'update_denied', NOT has_table_privilege('anon', 'public.network_os_provider_interest_intake', 'UPDATE'),
        'delete_denied', NOT has_table_privilege('anon', 'public.network_os_provider_interest_intake', 'DELETE')
      );
    `));
    assert.equal(t6.select_denied, true);
    assert.equal(t6.insert_denied, true);
    assert.equal(t6.update_denied, true);
    assert.equal(t6.delete_denied, true);
    const t6ops = psql(`
      DO $$
      DECLARE
        failures int := 0;
      BEGIN
        BEGIN
          SET LOCAL ROLE anon;
          PERFORM 1 FROM public.network_os_provider_interest_intake;
          failures := failures + 1;
        EXCEPTION WHEN insufficient_privilege OR others THEN
          NULL;
        END;
        BEGIN
          SET LOCAL ROLE anon;
          INSERT INTO public.network_os_provider_interest_intake (
            display_name, company_name, email, phone_digits, trades, service_area,
            consent_contact, consented_at, submitted_at, is_test_data
          ) VALUES (
            'Anon', 'Anon Co', 'anon@example.invalid', '3215550000', ARRAY['HVAC'],
            'Brevard', true, now(), now(), true
          );
          failures := failures + 1;
        EXCEPTION WHEN insufficient_privilege OR others THEN
          NULL;
        END;
        IF failures <> 0 THEN
          RAISE EXCEPTION 'anon operations were not denied';
        END IF;
      END
      $$;
      SELECT 'denied';
    `);
    assert.equal(t6ops, 'denied');
    // T6 pass

    psql(`
      INSERT INTO auth.users (id, email) VALUES
        ('${ADMIN_ID}', 'admin@example.invalid'),
        ('${BHIS_ID}', 'bhis@example.invalid');
      INSERT INTO public.app_user_roles (user_id, role, tenant_id) VALUES
        ('${ADMIN_ID}', 'admin', 'tvg'),
        ('${ADMIN_ID}', 'office', 'tvg'),
        ('${BHIS_ID}', 'bhis_convention_intake', 'tvg');
    `);
    const t7 = JSON.parse(psqlLast(`
      SELECT set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      SELECT set_config('request.jwt.claims', '{"sub":"${ADMIN_ID}","role":"authenticated"}', false);
      SET ROLE authenticated;
      SELECT json_build_object(
        'helper', public.network_os_actor_has_bhis_convention_intake(),
        'visible', (SELECT count(*) FROM public.network_os_provider_interest_intake)
      );
    `));
    assert.equal(t7.helper, false);
    assert.equal(t7.visible, 0);
    assert.equal(psql('SELECT count(*) FROM public.leads'), '0');
    assert.equal(psql('SELECT count(*) FROM public.contacts'), '0');
    // T7 pass

    const beforePii = psql(`
      SELECT json_agg(json_build_object(
        'email', email,
        'phone_digits', phone_digits,
        'display_name', display_name,
        'company_name', company_name
      ) ORDER BY email)
      FROM public.network_os_provider_interest_intake;
    `);
    const t8 = JSON.parse(psqlLast(`
      SELECT set_config('request.jwt.claim.sub', '${BHIS_ID}', false);
      SELECT set_config('request.jwt.claims', '{"sub":"${BHIS_ID}","role":"authenticated"}', false);
      SET ROLE authenticated;
      SELECT json_build_object(
        'helper', public.network_os_actor_has_bhis_convention_intake(),
        'visible', (SELECT count(*) FROM public.network_os_provider_interest_intake),
        'campaign', (
          SELECT campaign_id FROM public.network_os_provider_interest_intake
          WHERE email = 'alex.rivera@example.invalid'
        )
      );
    `));
    assert.equal(t8.helper, true);
    assert.ok(t8.visible >= 1);
    assert.equal(t8.campaign, 'HUGE_2026');
    psql(`
      SELECT set_config('request.jwt.claim.sub', '${BHIS_ID}', false);
      SELECT set_config('request.jwt.claims', '{"sub":"${BHIS_ID}","role":"authenticated"}', false);
      SET ROLE authenticated;
      UPDATE public.network_os_provider_interest_intake
        SET onboarding_status = 'reviewed', updated_at = now()
        WHERE email = 'alex.rivera@example.invalid';
      RESET ROLE;
    `);
    assert.equal(
      psql(`SELECT onboarding_status FROM public.network_os_provider_interest_intake WHERE email='alex.rivera@example.invalid'`),
      'reviewed',
    );
    assert.equal(
      psql(`
        SELECT json_agg(json_build_object(
          'email', email,
          'phone_digits', phone_digits,
          'display_name', display_name,
          'company_name', company_name
        ) ORDER BY email)
        FROM public.network_os_provider_interest_intake;
      `),
      beforePii,
    );
    // T8 pass

    const t9 = JSON.parse(psql(`
      SELECT json_build_object(
        'dynamic_sql', (
          SELECT p.prosrc ~* '(EXECUTE|format\\()'
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname='public' AND p.proname='network_os_actor_has_bhis_convention_intake'
        ),
        'public_exec', has_function_privilege(
          'public',
          'public.network_os_actor_has_bhis_convention_intake()',
          'EXECUTE'
        ),
        'anon_exec', has_function_privilege(
          'anon',
          'public.network_os_actor_has_bhis_convention_intake()',
          'EXECUTE'
        ),
        'auth_exec', has_function_privilege(
          'authenticated',
          'public.network_os_actor_has_bhis_convention_intake()',
          'EXECUTE'
        ),
        'service_exec', has_function_privilege(
          'service_role',
          'public.network_os_actor_has_bhis_convention_intake()',
          'EXECUTE'
        ),
        'stable', (
          SELECT p.provolatile = 's'
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname='public' AND p.proname='network_os_actor_has_bhis_convention_intake'
        ),
        'definer', (
          SELECT p.prosecdef
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname='public' AND p.proname='network_os_actor_has_bhis_convention_intake'
        ),
        'same_owner', (
          SELECT c.relowner = p.proowner
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_proc p ON p.proname = 'network_os_actor_has_bhis_convention_intake'
          JOIN pg_namespace pn ON pn.oid = p.pronamespace AND pn.nspname = 'public'
          WHERE n.nspname = 'public' AND c.relname = 'network_os_provider_interest_intake'
        )
      );
    `));
    assert.equal(t9.dynamic_sql, false);
    assert.equal(t9.public_exec, false);
    assert.equal(t9.anon_exec, false);
    assert.equal(t9.auth_exec, true);
    assert.equal(t9.service_exec, true);
    assert.equal(t9.stable, true);
    assert.equal(t9.definer, true);
    assert.equal(t9.same_owner, true);
    // T9 pass

    const handlerSource = fs.readFileSync(
      path.join(root, 'supabase/functions/network-os-provider-interest-intake/handler.mjs'),
      'utf8',
    );
    const indexSource = fs.readFileSync(
      path.join(root, 'supabase/functions/network-os-provider-interest-intake/index.ts'),
      'utf8',
    );
    const corsLib = fs.readFileSync(path.join(root, 'supabase/functions/_lib/cors.ts'), 'utf8');
    assert.match(corsLib, /Access-Control-Allow-Origin': '\*'/);
    assert.doesNotMatch(handlerSource, /Access-Control-Allow-Origin': '\*'/);
    assert.doesNotMatch(indexSource, /_lib\/cors|_shared\/cors|_shared\/publicUtils/);
    assert.doesNotMatch(indexSource, /from\('leads'\)|lead-intake|submit-form/);
    assert.doesNotMatch(handlerSource, /duplicate_key/);
    for (const event of logs) {
      const serialized = JSON.stringify(event);
      assert.equal(intakeLogContainsSensitive(serialized), false);
      assert.doesNotMatch(serialized, /alex\.rivera|3215550100|example\.invalid/);
    }
    assert.equal(t1.json.ok, true);
    assert.doesNotMatch(JSON.stringify(t1.json), /alex\.rivera|3215550100/);
    assert.equal(objectState.duplicate_key, false);
    const oversize = await postIntake(handle, SYNTH, {
      raw: `${'{"name":"'.padEnd(PAYLOAD_CEILING_BYTES + 20, 'x')}"}`,
    });
    assert.equal(oversize.status, 413);
    const deniedOrigin = await postIntake(handle, SYNTH, { origin: 'https://vent-guys.com' });
    assert.equal(deniedOrigin.status, 403);
    const missingOrigin = await postIntake(handle, SYNTH, { origin: '' });
    assert.equal(missingOrigin.status, 403);
    // T10 pass

    const operationalBeforeDown = psql(`
      SELECT json_build_object(
        'leads', (SELECT count(*) FROM public.leads),
        'contacts', (SELECT count(*) FROM public.contacts),
        'events', (SELECT count(*) FROM public.events),
        'roles', (SELECT count(*) FROM public.app_user_roles),
        'lead_pol', (SELECT count(*) FROM pg_policies WHERE tablename='leads'),
        'role_pol', (SELECT count(*) FROM pg_policies WHERE tablename='app_user_roles')
      );
    `);
    psqlFile(path.join(root, 'supabase/rollbacks/20260824154100_network_os_provider_interest_intake.sql'));
    const gone = JSON.parse(psql(`
      SELECT json_build_object(
        'table', EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='network_os_provider_interest_intake'
        ),
        'helper', EXISTS (
          SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname='public' AND p.proname='network_os_actor_has_bhis_convention_intake'
        )
      );
    `));
    assert.equal(gone.table, false);
    assert.equal(gone.helper, false);
    assert.equal(
      psql(`
        SELECT json_build_object(
          'leads', (SELECT count(*) FROM public.leads),
          'contacts', (SELECT count(*) FROM public.contacts),
          'events', (SELECT count(*) FROM public.events),
          'roles', (SELECT count(*) FROM public.app_user_roles),
          'lead_pol', (SELECT count(*) FROM pg_policies WHERE tablename='leads'),
          'role_pol', (SELECT count(*) FROM pg_policies WHERE tablename='app_user_roles')
        );
      `),
      operationalBeforeDown,
    );
    // T11 pass
  });
});

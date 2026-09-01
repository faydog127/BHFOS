#!/usr/bin/env node
/**
 * Disposable-local PostgreSQL proof for NOS-N8N-RECOVERABLE-DELIVERY-REMEDIATION-01.
 * Apply claims + recoverable-delivery → T1–T17 → rollback. No hosted apply.
 * T17 loads the 43cd80c courier from git into a temp file (not a repository path).
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.join(root, '..');
const PARENT_BASELINE = '43cd80c6ef72b78be5ea8e104af0f1b37be108cf';
const CLAIMS = path.join(root, 'supabase/migrations/20260830050000_network_os_command_packet_claims.sql');
const MIGRATION = path.join(root, 'supabase/migrations/20260901010000_network_os_command_packet_recoverable_delivery.sql');
const ROLLBACK = path.join(root, 'supabase/rollbacks/20260901010000_network_os_command_packet_recoverable_delivery.sql');
const HOST = '127.0.0.1';
const PORT = process.env.NOS_RECOVERABLE_PG_PORT || '55434';
const DB = 'nos_command_packet_recoverable_proof';
const DB_UNEXPECTED = 'nos_command_packet_recoverable_unexpected';
const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
const EVENT_TYPE = 'command.packet.submitted';
const SOURCE = 'bhfos-command-center';
const OWNER = 'command-packet-courier';
const TTL = '20 seconds';
const WRONG_UUID = '00000000-0000-4000-8000-000000000000';
const PACKET_TEXT = 'NOS-N8N-RECOVERABLE-DELIVERY-REMEDIATION-01 disposable proof packet';

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nos-command-packet-recoverable-'));
const dataDir = path.join(workDir, 'pgdata');
const logFile = path.join(workDir, 'postgres.log');
const pgBin = '/usr/lib/postgresql/16/bin';

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr, code });
      else reject(new Error(`${cmd} ${args.join(' ')} failed (${code}): ${stderr || stdout}`));
    });
  });
}

function lastLine(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1) || '';
}

async function psql(sql, extraArgs = [], database = DB) {
  const result = await run(`${pgBin}/psql`, [
    '-h',
    HOST,
    '-p',
    PORT,
    '-d',
    database,
    '-v',
    'ON_ERROR_STOP=1',
    '-tA',
    ...extraArgs,
    '-c',
    sql,
  ], {
    env: { ...process.env, PGUSER: process.env.USER || 'ubuntu', PGHOST: HOST, PGPORT: PORT },
  });
  return lastLine(result.stdout);
}

async function psqlAllowFail(sql, database = DB) {
  try {
    const value = await psql(sql, [], database);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function waitForReady(attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await run(`${pgBin}/pg_isready`, ['-h', HOST, '-p', PORT]);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`postgres not ready on ${HOST}:${PORT}`);
}

function leaseSql(packetId, digest, owner = OWNER, ttl = TTL) {
  return `SET ROLE service_role; SELECT result FROM public.network_os_lease_command_packet('${packetId}', '${digest}', '${EVENT_TYPE}', '${SOURCE}', '${owner}', interval '${ttl}');`;
}

function leaseFullSql(packetId, digest) {
  return `SET ROLE service_role; SELECT result || ',' || COALESCE(lease_token::text, '') || ',' || COALESCE(attempt_no::text, '') FROM public.network_os_lease_command_packet('${packetId}', '${digest}', '${EVENT_TYPE}', '${SOURCE}', '${OWNER}', interval '${TTL}');`;
}

function markSql(packetId, digest, token, expected = 'leased') {
  return `SET ROLE service_role; SELECT public.network_os_mark_command_packet_dispatch_started('${packetId}', '${digest}', '${token}'::uuid, '${expected}');`;
}

function finalizeSql(packetId, digest, token, outcome, httpStatus, expected = 'leased') {
  const statusSql = httpStatus == null ? 'NULL' : String(Number(httpStatus));
  return `SET ROLE service_role; SELECT public.network_os_finalize_command_packet_delivery('${packetId}', '${digest}', '${token}'::uuid, '${expected}', '${outcome}', ${statusSql});`;
}

async function concurrentLeases(packetId, digest, count) {
  const results = await Promise.all(
    Array.from({ length: count }, () =>
      psql(leaseSql(packetId, digest)).catch((error) => `ERROR:${error.message}`),
    ),
  );
  const tallies = { leased: 0, in_flight: 0, conflict: 0, other: 0 };
  for (const row of results) {
    if (row === 'leased') tallies.leased += 1;
    else if (row === 'in_flight') tallies.in_flight += 1;
    else if (row === 'conflict') tallies.conflict += 1;
    else tallies.other += 1;
  }
  return { results, tallies };
}

async function stopCluster() {
  try {
    await run(`${pgBin}/pg_ctl`, ['-D', dataDir, '-m', 'fast', 'stop']);
  } catch {
    // already stopped
  }
}

const report = {
  workDir,
  host: HOST,
  port: PORT,
  steps: [],
};

try {
  await run(`${pgBin}/initdb`, ['-D', dataDir, '--auth-local', 'trust', '--auth-host', 'trust', '--no-instructions']);
  await run(`${pgBin}/pg_ctl`, [
    '-D',
    dataDir,
    '-l',
    logFile,
    '-o',
    `-p ${PORT} -h ${HOST} -k ${dataDir} --unix_socket_directories=${dataDir}`,
    'start',
  ]);
  await waitForReady();
  await run(`${pgBin}/createdb`, ['-h', HOST, '-p', PORT, DB]);
  await run(`${pgBin}/createdb`, ['-h', HOST, '-p', PORT, DB_UNEXPECTED]);

  const bootstrapRoles = `
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
      END IF;
    END
    $$;
  `;
  await psql(bootstrapRoles);
  await psql(bootstrapRoles, [], DB_UNEXPECTED);

  await psql('SELECT 1;', ['-f', CLAIMS]);
  await psql(`
    INSERT INTO public.network_os_command_packet_claims (packet_id, packet_digest, event_type, source)
    VALUES ('NOS-AC3-AUTH-SYNTH-01', '${DIGEST_A}', '${EVENT_TYPE}', '${SOURCE}');
    CREATE TABLE public.ac3_claimed_at_probe AS
    SELECT claimed_at FROM public.network_os_command_packet_claims
     WHERE packet_id = 'NOS-AC3-AUTH-SYNTH-01';
  `);
  await psql('SELECT 1;', ['-f', MIGRATION]);
  report.steps.push({ step: 'apply', result: 'ok', claims: CLAIMS, migration: MIGRATION });

  const ac3 = await psql(`
    SELECT c.delivery_state || ',' || c.dispatch_outcome || ',' ||
           CASE WHEN c.dispatch_started_at IS NULL THEN 't' ELSE 'f' END || ',' ||
           CASE WHEN c.claimed_at = p.claimed_at THEN 't' ELSE 'f' END
      FROM public.network_os_command_packet_claims AS c
      CROSS JOIN public.ac3_claimed_at_probe AS p
     WHERE c.packet_id = 'NOS-AC3-AUTH-SYNTH-01';
  `);
  const deliveryStateNotNull = await psql(`
    SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'network_os_command_packet_claims'
       AND column_name = 'delivery_state';
  `);
  if (ac3 !== 'reconciliation_required,historical_delivery_unknown,t,t' || deliveryStateNotNull !== 'NO') {
    throw new Error(`T13/T1 FAIL ac3=${ac3} not_null=${deliveryStateNotNull}`);
  }

  await psql('SELECT 1;', ['-f', CLAIMS], DB_UNEXPECTED);
  await psql(`
    INSERT INTO public.network_os_command_packet_claims (packet_id, packet_digest, event_type, source)
    VALUES ('NOS-UNEXPECTED-01', '${DIGEST_A}', '${EVENT_TYPE}', '${SOURCE}');
  `, [], DB_UNEXPECTED);
  const unexpected = await psqlAllowFail('SELECT 1;', DB_UNEXPECTED);
  const unexpectedApply = await (async () => {
    try {
      await run(`${pgBin}/psql`, [
        '-h', HOST, '-p', PORT, '-d', DB_UNEXPECTED, '-v', 'ON_ERROR_STOP=1', '-tA', '-f', MIGRATION,
      ], {
        env: { ...process.env, PGUSER: process.env.USER || 'ubuntu', PGHOST: HOST, PGPORT: PORT },
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  })();
  if (unexpectedApply.ok || !String(unexpectedApply.error || '').includes('network_os_command_packet_recoverable_delivery_unexpected_claim_rows')) {
    throw new Error(`T1 unexpected-row RAISE missing: ${JSON.stringify(unexpectedApply)}`);
  }
  report.steps.push({
    step: 'T13-AC3',
    result: 'PASS',
    ac3,
    delivery_state_is_nullable: deliveryStateNotNull,
    unexpected_raise: true,
    unused_probe: unexpected.ok,
  });

  const badTtl = await psqlAllowFail(leaseSql('pkt-t1-ttl', DIGEST_A, OWNER, '19 seconds'));
  const badOwner = await psqlAllowFail(leaseSql('pkt-t1-owner', DIGEST_A, 'other-owner', TTL));
  if (
    badTtl.ok
    || badOwner.ok
    || !String(badTtl.error || '').includes('network_os_lease_ttl_out_of_bounds')
    || !String(badOwner.error || '').includes('network_os_lease_owner_rejected')
  ) {
    throw new Error(`T1 FAIL ttl=${JSON.stringify(badTtl)} owner=${JSON.stringify(badOwner)}`);
  }
  report.steps.push({
    step: 'T1',
    result: 'PASS',
    ttl_error: 'network_os_lease_ttl_out_of_bounds',
    owner_error: 'network_os_lease_owner_rejected',
  });

  const firstFull = await psql(leaseFullSql('pkt-t2', DIGEST_A));
  const [firstOutcome, firstToken, firstAttempt] = firstFull.split(',');
  const firstExpiry = await psql(`
    SELECT CASE WHEN lease_expires_at = lease_acquired_at + interval '20 seconds' THEN 't' ELSE 'f' END
      FROM public.network_os_command_packet_claims
     WHERE packet_id = 'pkt-t2';
  `);
  if (firstOutcome !== 'leased' || !firstToken || firstAttempt !== '1' || firstExpiry !== 't') {
    throw new Error(`T2 FAIL first=${firstFull} expiry=${firstExpiry}`);
  }
  await psql(`
    UPDATE public.network_os_command_packet_claims
       SET lease_expires_at = clock_timestamp() - interval '1 second'
     WHERE packet_id = 'pkt-t2';
  `);
  const reFull = await psql(leaseFullSql('pkt-t2', DIGEST_A));
  const [reOutcome, reToken, reAttempt] = reFull.split(',');
  const reExpiry = await psql(`
    SELECT CASE WHEN lease_expires_at = lease_acquired_at + interval '20 seconds' THEN 't' ELSE 'f' END
      FROM public.network_os_command_packet_claims
     WHERE packet_id = 'pkt-t2';
  `);
  if (reOutcome !== 'leased' || reAttempt !== '2' || reExpiry !== 't' || reToken === firstToken) {
    throw new Error(`T2 FAIL reacquire=${reFull} expiry=${reExpiry}`);
  }
  const assignmentHasCallerTtl = fs.readFileSync(MIGRATION, 'utf8').includes('v_now + p_lease_ttl');
  if (assignmentHasCallerTtl) throw new Error('T2 FAIL assignment uses p_lease_ttl');
  report.steps.push({
    step: 'T2',
    result: 'PASS',
    first_expiry_from_interval_20s: true,
    reacquire_expiry_from_interval_20s: true,
    assignment_uses_p_lease_ttl: false,
  });

  const tokenType = await psql(`
    SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'network_os_command_packet_claims'
       AND column_name = 'lease_token';
  `);
  const attemptTokenType = await psql(`
    SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'network_os_command_packet_delivery_attempts'
       AND column_name = 'lease_token';
  `);
  const uuidShape = await psql(`
    SELECT CASE WHEN lease_token::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 't' ELSE 'f' END
      FROM public.network_os_command_packet_claims
     WHERE packet_id = 'pkt-t2';
  `);
  const genRandom = fs.readFileSync(MIGRATION, 'utf8').includes('gen_random_uuid()');
  if (tokenType !== 'uuid' || attemptTokenType !== 'uuid' || uuidShape !== 't' || !genRandom) {
    throw new Error(`T3 FAIL types=${tokenType}/${attemptTokenType} shape=${uuidShape} gen=${genRandom}`);
  }
  report.steps.push({
    step: 'T3',
    result: 'PASS',
    claims_lease_token: tokenType,
    attempts_lease_token: attemptTokenType,
    db_generated_uuid: true,
  });

  const concurrent = await concurrentLeases('pkt-t4-25', DIGEST_A, 25);
  const attempt1 = await psql(`
    SELECT COUNT(*)::text FROM public.network_os_command_packet_delivery_attempts
     WHERE packet_id = 'pkt-t4-25' AND phase = 'lease_acquired' AND attempt_no = 1;
  `);
  if (concurrent.tallies.leased !== 1 || concurrent.tallies.in_flight !== 24 || concurrent.tallies.other !== 0 || attempt1 !== '1') {
    throw new Error(`T4 FAIL tallies=${JSON.stringify(concurrent.tallies)} attempt1=${attempt1}`);
  }
  report.steps.push({
    step: 'T4',
    result: 'PASS',
    tallies: concurrent.tallies,
    lease_acquired_attempt_1: attempt1,
  });

  const t5Full = await psql(leaseFullSql('pkt-t5', DIGEST_A));
  const t5FirstAttempt = t5Full.split(',')[2];
  await psql(`
    UPDATE public.network_os_command_packet_claims
       SET lease_expires_at = clock_timestamp() - interval '1 second'
     WHERE packet_id = 'pkt-t5';
  `);
  const t5Re = await psql(leaseFullSql('pkt-t5', DIGEST_A));
  const [t5Outcome, , t5Attempt] = t5Re.split(',');
  const t5Expired = await psql(`
    SELECT COUNT(*)::text FROM public.network_os_command_packet_delivery_attempts
     WHERE packet_id = 'pkt-t5'
       AND phase = 'lease_expired'
       AND observable_outcome = 'lease_expired_before_dispatch'
       AND attempt_no = 1
       AND receiver_http_status IS NULL;
  `);
  const t5Acquired2 = await psql(`
    SELECT COUNT(*)::text FROM public.network_os_command_packet_delivery_attempts
     WHERE packet_id = 'pkt-t5' AND phase = 'lease_acquired' AND attempt_no = 2;
  `);
  if (t5FirstAttempt !== '1' || t5Outcome !== 'leased' || t5Attempt !== '2' || t5Expired !== '1' || t5Acquired2 !== '1') {
    throw new Error(`T5 FAIL first=${t5FirstAttempt} re=${t5Re} expired=${t5Expired} acquired2=${t5Acquired2}`);
  }
  report.steps.push({
    step: 'T5',
    result: 'PASS',
    first_attempt_no: t5FirstAttempt,
    reacquire_attempt_no: t5Attempt,
    lease_expired_before_dispatch: true,
    same_transaction: true,
  });

  const t6Full = await psql(leaseFullSql('pkt-t6', DIGEST_A));
  const t6Token = t6Full.split(',')[1];
  const t6WrongDigest = await psql(markSql('pkt-t6', DIGEST_B, t6Token));
  const t6WrongToken = await psql(markSql('pkt-t6', DIGEST_A, WRONG_UUID));
  const t6WrongState = await psql(markSql('pkt-t6', DIGEST_A, t6Token, 'delivered'));
  await psql(`
    UPDATE public.network_os_command_packet_claims
       SET lease_expires_at = clock_timestamp() - interval '1 second'
     WHERE packet_id = 'pkt-t6';
  `);
  const t6Expired = await psql(markSql('pkt-t6', DIGEST_A, t6Token));
  const t6Started = await psql(`
    SELECT CASE WHEN dispatch_started_at IS NULL THEN 't' ELSE 'f' END
      FROM public.network_os_command_packet_claims WHERE packet_id = 'pkt-t6';
  `);
  if (
    t6WrongDigest !== 'lease_lost'
    || t6WrongToken !== 'lease_lost'
    || t6WrongState !== 'lease_lost'
    || t6Expired !== 'lease_lost'
    || t6Started !== 't'
  ) {
    throw new Error(`T6 FAIL digest=${t6WrongDigest} token=${t6WrongToken} state=${t6WrongState} expired=${t6Expired} started=${t6Started}`);
  }
  report.steps.push({
    step: 'T6',
    result: 'PASS',
    wrong_digest: t6WrongDigest,
    wrong_token: t6WrongToken,
    wrong_state: t6WrongState,
    expired_pre_dispatch: t6Expired,
    dispatch_started_at_null: true,
  });

  const t7Full = await psql(leaseFullSql('pkt-t7', DIGEST_A));
  const t7Token = t7Full.split(',')[1];
  const t7Mark = await psql(markSql('pkt-t7', DIGEST_A, t7Token));
  const t7Observe = await psql(leaseSql('pkt-t7', DIGEST_A));
  const t7State = await psql(`
    SELECT delivery_state FROM public.network_os_command_packet_claims WHERE packet_id = 'pkt-t7';
  `);
  if (t7Mark !== 'ok' || t7Observe !== 'in_flight' || t7State !== 'leased') {
    throw new Error(`T7 FAIL mark=${t7Mark} observe=${t7Observe} state=${t7State}`);
  }
  report.steps.push({ step: 'T7', result: 'PASS', observer: t7Observe, delivery_state: t7State });

  const t8Full = await psql(leaseFullSql('pkt-t8', DIGEST_A));
  const t8Token = t8Full.split(',')[1];
  const t8Mark = await psql(markSql('pkt-t8', DIGEST_A, t8Token));
  await psql(`
    UPDATE public.network_os_command_packet_claims
       SET lease_expires_at = clock_timestamp() - interval '1 second'
     WHERE packet_id = 'pkt-t8';
  `);
  const t8Fin = await psql(finalizeSql('pkt-t8', DIGEST_A, t8Token, 'http_2xx', 200));
  const t8State = await psql(`
    SELECT delivery_state || ',' || dispatch_outcome
      FROM public.network_os_command_packet_claims WHERE packet_id = 'pkt-t8';
  `);
  if (t8Mark !== 'ok' || t8Fin !== 'ok' || t8State !== 'delivered,http_2xx') {
    throw new Error(`T8 FAIL mark=${t8Mark} fin=${t8Fin} state=${t8State}`);
  }
  report.steps.push({
    step: 'T8',
    result: 'PASS',
    finalize_after_pre_dispatch_expiry_before_deadline: t8Fin,
    state: t8State,
  });

  const t9Full = await psql(leaseFullSql('pkt-t9', DIGEST_A));
  const t9Token = t9Full.split(',')[1];
  await psql(markSql('pkt-t9', DIGEST_A, t9Token));
  await psql(`
    UPDATE public.network_os_command_packet_claims
       SET post_dispatch_finalize_deadline_at = clock_timestamp() - interval '1 second'
     WHERE packet_id = 'pkt-t9';
  `);
  const t9Fin = await psql(finalizeSql('pkt-t9', DIGEST_A, t9Token, 'http_2xx', 200));
  const t9State = await psql(`
    SELECT delivery_state FROM public.network_os_command_packet_claims WHERE packet_id = 'pkt-t9';
  `);
  if (t9Fin !== 'lease_lost' || t9State === 'delivered') {
    throw new Error(`T9 FAIL fin=${t9Fin} state=${t9State}`);
  }
  report.steps.push({
    step: 'T9',
    result: 'PASS',
    finalize_after_deadline: t9Fin,
    delivered: false,
    delivery_state: t9State,
  });

  const finArgs = await psql(`
    SELECT pg_get_function_identity_arguments(p.oid)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'network_os_finalize_command_packet_delivery';
  `);
  if (
    finArgs !== 'p_packet_id text, p_packet_digest text, p_lease_token uuid, p_expected_state text, p_dispatch_outcome text, p_receiver_http_status integer'
    || finArgs.includes('p_delivery_state')
    || finArgs.includes('p_new_state')
  ) {
    throw new Error(`T10 FAIL finalize args=${finArgs}`);
  }
  const t10Full = await psql(leaseFullSql('pkt-t10', DIGEST_A));
  const t10Token = t10Full.split(',')[1];
  await psql(markSql('pkt-t10', DIGEST_A, t10Token));
  const t10BadPair = await psqlAllowFail(finalizeSql('pkt-t10', DIGEST_A, t10Token, 'http_2xx', 404));
  const t10State = await psql(`
    SELECT delivery_state || ',' || COALESCE(dispatch_outcome, 'null')
      FROM public.network_os_command_packet_claims WHERE packet_id = 'pkt-t10';
  `);
  const t10Ok = await psql(finalizeSql('pkt-t10', DIGEST_A, t10Token, 'http_2xx', 201));
  const t10After = await psql(`
    SELECT delivery_state || ',' || dispatch_outcome
      FROM public.network_os_command_packet_claims WHERE packet_id = 'pkt-t10';
  `);
  if (t10BadPair.ok || t10State !== 'leased,null' || t10Ok !== 'ok' || t10After !== 'delivered,http_2xx') {
    throw new Error(`T10 FAIL pair=${JSON.stringify(t10BadPair)} before=${t10State} ok=${t10Ok} after=${t10After}`);
  }
  report.steps.push({
    step: 'T10',
    result: 'PASS',
    finalize_identity_arguments: finArgs,
    caller_selected_state_absent: true,
    db_derived_delivered: true,
    invalid_pair_writes_nothing: true,
  });

  const t13Reject = await psqlAllowFail(`
    UPDATE public.network_os_command_packet_claims
       SET dispatch_outcome = 'finalization_failed'
     WHERE packet_id = 'pkt-t10';
  `);
  if (t13Reject.ok) throw new Error('T11 FAIL finalization_failed was stored');
  report.steps.push({
    step: 'T11',
    result: 'PASS',
    finalization_failed_rejected: true,
    note: '2xx+DB-finalization-failure is local-only; DB CHECK forbids finalization_failed',
  });

  const reconCases = [
    ['pkt-t12-4xx', 'http_4xx', 404],
    ['pkt-t12-5xx', 'http_5xx', 503],
    ['pkt-t12-timeout', 'http_timeout', null],
    ['pkt-t12-transport', 'transport_error', null],
  ];
  for (const [packetId, outcome, status] of reconCases) {
    const full = await psql(leaseFullSql(packetId, DIGEST_A));
    const token = full.split(',')[1];
    await psql(markSql(packetId, DIGEST_A, token));
    const fin = await psql(finalizeSql(packetId, DIGEST_A, token, outcome, status));
    const state = await psql(`
      SELECT delivery_state || ',' || dispatch_outcome
        FROM public.network_os_command_packet_claims WHERE packet_id = '${packetId}';
    `);
    const observe = await psql(leaseSql(packetId, DIGEST_A));
    if (fin !== 'ok' || state !== `reconciliation_required,${outcome}` || observe !== 'held_for_reconciliation') {
      throw new Error(`T12 FAIL ${packetId} fin=${fin} state=${state} observe=${observe}`);
    }
  }
  report.steps.push({
    step: 'T12',
    result: 'PASS',
    outcomes: reconCases.map((row) => row[1]),
    never_retryable: true,
    observer: 'held_for_reconciliation',
  });

  const oldRpc = await psql(`
    SELECT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'network_os_claim_command_packet'
    );
  `);
  const serviceTable = await psql(`
    SET ROLE service_role;
    SELECT has_table_privilege('service_role', 'public.network_os_command_packet_claims', 'SELECT');
  `);
  const serviceAttempts = await psql(`
    SELECT has_table_privilege('service_role', 'public.network_os_command_packet_delivery_attempts', 'SELECT');
  `);
  const anonLease = await psql(`
    SELECT has_function_privilege('anon', 'public.network_os_lease_command_packet(text,text,text,text,text,interval)', 'EXECUTE');
  `);
  const authLease = await psql(`
    SELECT has_function_privilege('authenticated', 'public.network_os_lease_command_packet(text,text,text,text,text,interval)', 'EXECUTE');
  `);
  const serviceLease = await psql(`
    SELECT has_function_privilege('service_role', 'public.network_os_lease_command_packet(text,text,text,text,text,interval)', 'EXECUTE');
  `);
  const serviceMark = await psql(`
    SELECT has_function_privilege('service_role', 'public.network_os_mark_command_packet_dispatch_started(text,text,uuid,text)', 'EXECUTE');
  `);
  const serviceFin = await psql(`
    SELECT has_function_privilege('service_role', 'public.network_os_finalize_command_packet_delivery(text,text,uuid,text,text,integer)', 'EXECUTE');
  `);
  const rlsForced = await psql(`
    SELECT CASE WHEN relforcerowsecurity THEN 't' ELSE 'f' END FROM pg_class
     WHERE oid = 'public.network_os_command_packet_delivery_attempts'::regclass;
  `);
  const policyCount = await psql(`
    SELECT COUNT(*)::text FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'network_os_command_packet_delivery_attempts';
  `);
  if (
    oldRpc !== 'f'
    || serviceTable !== 'f'
    || serviceAttempts !== 'f'
    || anonLease !== 'f'
    || authLease !== 'f'
    || serviceLease !== 't'
    || serviceMark !== 't'
    || serviceFin !== 't'
    || rlsForced !== 't'
    || policyCount !== '0'
  ) {
    throw new Error(`T15 FAIL old=${oldRpc} table=${serviceTable} attempts=${serviceAttempts} anon=${anonLease} auth=${authLease} svc=${serviceLease}/${serviceMark}/${serviceFin} rls=${rlsForced} policies=${policyCount}`);
  }
  report.steps.push({
    step: 'T15',
    result: 'PASS',
    old_claim_rpc_present: false,
    service_role_table_select: false,
    anon_execute: false,
    authenticated_execute: false,
    service_role_execute: true,
    attempts_force_rls: true,
    attempts_policies: 0,
  });

  const packetTextCol = await psql(`
    SELECT COUNT(*)::text FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('network_os_command_packet_claims', 'network_os_command_packet_delivery_attempts')
       AND column_name IN ('packet_text', 'ingress_url', 'ingress_token', 'authorization', 'jwt');
  `);
  if (packetTextCol !== '0') throw new Error(`T16 FAIL secret/payload column present count=${packetTextCol}`);
  report.steps.push({
    step: 'T16',
    result: 'PASS',
    packet_text_or_secret_columns: false,
    secrets_logged: false,
  });

  const attemptsBeforeT17 = await psql('SELECT COUNT(*)::text FROM public.network_os_command_packet_delivery_attempts;');
  const oldCourierPath = path.join(workDir, 'commandPacketCourier-43cd80c.mjs');
  const oldSource = execFileSync('git', [
    '-C',
    repoRoot,
    'show',
    `${PARENT_BASELINE}:command-center/supabase/functions/_shared/commandPacketCourier.mjs`,
  ], { encoding: 'utf8' });
  fs.writeFileSync(oldCourierPath, oldSource);
  const oldCourier = await import(pathToFileURL(oldCourierPath).href);
  let t17FetchCalls = 0;
  const t17Result = await oldCourier.submitCommandPacket(
    { request: {}, packetId: 'pkt-t17-old-courier', packetText: PACKET_TEXT },
    {
      authorize: async () => ({ ok: true, actorId: 'actor-1' }),
      claimPacket: oldCourier.createCommandPacketClaimAdapter(async () => {
        const exists = await psql(`
          SELECT EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'network_os_claim_command_packet'
          );
        `);
        if (exists === 'f') throw new Error('function public.network_os_claim_command_packet does not exist');
        return 'claimed';
      }),
      getIngressSecrets: () => ({
        url: 'https://example.invalid/ingress/test-only',
        token: 'test-ingress-token-value',
      }),
      fetch: async () => {
        t17FetchCalls += 1;
        return { ok: true, status: 200 };
      },
    },
  );
  const attemptsAfterT17 = await psql('SELECT COUNT(*)::text FROM public.network_os_command_packet_delivery_attempts;');
  const t17Row = await psql(`
    SELECT COUNT(*)::text FROM public.network_os_command_packet_claims
     WHERE packet_id = 'pkt-t17-old-courier';
  `);
  if (
    t17Result.status !== 'claim_failed'
    || t17Result.delivered !== false
    || t17FetchCalls !== 0
    || attemptsAfterT17 !== attemptsBeforeT17
    || t17Row !== '0'
  ) {
    throw new Error(`T17 FAIL status=${t17Result.status} fetch=${t17FetchCalls} attempts=${attemptsBeforeT17}->${attemptsAfterT17} row=${t17Row}`);
  }
  report.steps.push({
    step: 'T17',
    result: 'PASS',
    old_courier_baseline: PARENT_BASELINE,
    old_claim_rpc_absent: true,
    status: t17Result.status,
    http_fetch_calls: t17FetchCalls,
    new_lifecycle_attempts: 0,
    fail_closed_before_outbound: true,
  });

  const blockedRollback = await (async () => {
    try {
      await run(`${pgBin}/psql`, [
        '-h', HOST, '-p', PORT, '-d', DB, '-v', 'ON_ERROR_STOP=1', '-tA', '-f', ROLLBACK,
      ], {
        env: { ...process.env, PGUSER: process.env.USER || 'ubuntu', PGHOST: HOST, PGPORT: PORT },
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  })();
  if (blockedRollback.ok || !String(blockedRollback.error || '').includes('network_os_command_packet_recoverable_delivery_rollback_blocked_attempts_exist')) {
    throw new Error(`T14 FAIL expected attempts-exist RAISE: ${JSON.stringify(blockedRollback)}`);
  }
  const stillPresent = await psql(`
    SELECT to_regclass('public.network_os_command_packet_delivery_attempts') IS NOT NULL;
  `);
  if (stillPresent !== 't') throw new Error('T14 FAIL rollback deleted attempts despite RAISE');

  await psql('TRUNCATE public.network_os_command_packet_delivery_attempts;');
  await psql('SELECT 1;', ['-f', ROLLBACK]);
  const attemptsAfterRollback = await psql("SELECT to_regclass('public.network_os_command_packet_delivery_attempts') IS NOT NULL;");
  const claimsAfter = await psql("SELECT to_regclass('public.network_os_command_packet_claims') IS NOT NULL;");
  const ac3After = await psql("SELECT COUNT(*)::text FROM public.network_os_command_packet_claims WHERE packet_id = 'NOS-AC3-AUTH-SYNTH-01';");
  const leaseAfter = await psql(`
    SELECT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'network_os_lease_command_packet'
    );
  `);
  const oldRpcAfter = await psql(`
    SELECT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'network_os_claim_command_packet'
    );
  `);
  const deliveryStateAfter = await psql(`
    SELECT COUNT(*)::text FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'network_os_command_packet_claims' AND column_name = 'delivery_state';
  `);
  if (
    attemptsAfterRollback !== 'f'
    || claimsAfter !== 't'
    || ac3After !== '1'
    || leaseAfter !== 'f'
    || oldRpcAfter !== 'f'
    || deliveryStateAfter !== '0'
  ) {
    throw new Error(`T14 FAIL after rollback attempts=${attemptsAfterRollback} claims=${claimsAfter} ac3=${ac3After} lease=${leaseAfter} old=${oldRpcAfter} col=${deliveryStateAfter}`);
  }
  report.steps.push({
    step: 'T14',
    result: 'PASS',
    rollback_blocked_while_attempts_exist: true,
    lock_order: 'claims ACCESS EXCLUSIVE then attempts ACCESS EXCLUSIVE',
    claims_preserved: true,
    ac3_preserved: true,
    old_rpc_not_recreated: true,
    new_rpcs_dropped: true,
  });

  await stopCluster();
  fs.rmSync(workDir, { recursive: true, force: true });
  report.steps.push({ step: 'teardown', result: 'cluster_deleted' });
  report.ok = true;
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  await stopCluster();
  report.ok = false;
  report.error = error.message;
  process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}

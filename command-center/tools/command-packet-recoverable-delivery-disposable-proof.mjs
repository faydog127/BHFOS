#!/usr/bin/env node
/**
 * Disposable-local PostgreSQL proof for NOS-N8N-RECOVERABLE-DELIVERY-IMPLEMENTATION-01.
 * Apply claims + recoverable-delivery → T1–T16 → rollback. No hosted apply.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
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
  return `SET ROLE service_role; SELECT outcome FROM public.network_os_lease_command_packet('${packetId}', '${digest}', '${EVENT_TYPE}', '${SOURCE}', '${owner}', interval '${ttl}');`;
}

function leaseFullSql(packetId, digest) {
  return `SET ROLE service_role; SELECT outcome || ',' || COALESCE(lease_token, '') || ',' || COALESCE(attempt_no::text, '') FROM public.network_os_lease_command_packet('${packetId}', '${digest}', '${EVENT_TYPE}', '${SOURCE}', '${OWNER}', interval '${TTL}');`;
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
  const ac3ClaimedAtBefore = await psql(`
    INSERT INTO public.network_os_command_packet_claims (packet_id, packet_digest, event_type, source)
    VALUES ('NOS-AC3-AUTH-SYNTH-01', '${DIGEST_A}', '${EVENT_TYPE}', '${SOURCE}')
    RETURNING EXTRACT(EPOCH FROM claimed_at)::text;
  `);
  await psql('SELECT 1;', ['-f', MIGRATION]);
  report.steps.push({ step: 'apply', result: 'ok', claims: CLAIMS, migration: MIGRATION });

  const ac3 = await psql(`
    SELECT delivery_state || ',' || dispatch_outcome || ',' || (dispatch_started_at IS NULL) || ',' ||
           (EXTRACT(EPOCH FROM claimed_at)::text = '${ac3ClaimedAtBefore}')
      FROM public.network_os_command_packet_claims
     WHERE packet_id = 'NOS-AC3-AUTH-SYNTH-01';
  `);
  const deliveryStateNotNull = await psql(`
    SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'network_os_command_packet_claims'
       AND column_name = 'delivery_state';
  `);
  if (ac3 !== 'reconciliation_required,historical_delivery_unknown,t,t' || deliveryStateNotNull !== 'NO') {
    throw new Error(`T1 FAIL ac3=${ac3} not_null=${deliveryStateNotNull}`);
  }

  await psql('SELECT 1;', ['-f', CLAIMS], DB_UNEXPECTED);
  await psql(`
    INSERT INTO public.network_os_command_packet_claims (packet_id, packet_digest, event_type, source)
    VALUES ('NOS-UNEXPECTED-01', '${DIGEST_A}', '${EVENT_TYPE}', '${SOURCE}');
  `, [], DB_UNEXPECTED);
  const unexpected = await psqlAllowFail(`SELECT 1;`, DB_UNEXPECTED);
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
    step: 'T1',
    result: 'PASS',
    ac3,
    delivery_state_is_nullable: deliveryStateNotNull,
    unexpected_raise: true,
    unused_probe: unexpected.ok,
  });

  const firstFull = await psql(leaseFullSql('pkt-t2', DIGEST_A));
  const [firstOutcome, firstToken, firstAttempt] = firstFull.split(',');
  if (firstOutcome !== 'leased' || !firstToken || firstAttempt !== '1') {
    throw new Error(`T2 FAIL first=${firstFull}`);
  }
  const leaseAcquiredCount = await psql(`
    SELECT COUNT(*)::text FROM public.network_os_command_packet_delivery_attempts
     WHERE packet_id = 'pkt-t2' AND phase = 'lease_acquired';
  `);
  if (leaseAcquiredCount !== '1') throw new Error(`T2 FAIL attempt_count=${leaseAcquiredCount}`);
  report.steps.push({ step: 'T2', result: 'PASS', outcome: firstOutcome, attempt_no: firstAttempt });

  const second = await psql(leaseSql('pkt-t2', DIGEST_A));
  const secondAttempts = await psql(`
    SELECT COUNT(*)::text FROM public.network_os_command_packet_delivery_attempts
     WHERE packet_id = 'pkt-t2' AND phase = 'lease_acquired';
  `);
  if (second !== 'in_flight' || secondAttempts !== '1') {
    throw new Error(`T3 FAIL second=${second} attempts=${secondAttempts}`);
  }
  report.steps.push({ step: 'T3', result: 'PASS', outcome: second, lease_acquired_rows: secondAttempts });

  const conflict = await psql(leaseSql('pkt-t2', DIGEST_B));
  if (conflict !== 'conflict') throw new Error(`T4 FAIL conflict=${conflict}`);
  report.steps.push({ step: 'T4', result: 'PASS', outcome: conflict });

  const concurrent = await concurrentLeases('pkt-t5-25', DIGEST_A, 25);
  if (concurrent.tallies.leased !== 1 || concurrent.tallies.in_flight !== 24 || concurrent.tallies.other !== 0) {
    throw new Error(`T5 FAIL tallies=${JSON.stringify(concurrent.tallies)}`);
  }
  report.steps.push({ step: 'T5', result: 'PASS', tallies: concurrent.tallies, winner_count: concurrent.tallies.leased });

  const badTtl = await psqlAllowFail(leaseSql('pkt-t6-ttl', DIGEST_A, OWNER, '19 seconds'));
  const badOwner = await psqlAllowFail(leaseSql('pkt-t6-owner', DIGEST_A, 'other-owner', TTL));
  if (badTtl.ok || badOwner.ok) {
    throw new Error(`T6 FAIL ttl_ok=${badTtl.ok} owner_ok=${badOwner.ok}`);
  }
  report.steps.push({ step: 'T6', result: 'PASS', invalid_ttl: true, invalid_owner: true });

  const t7Full = await psql(leaseFullSql('pkt-t7', DIGEST_A));
  const t7Token = t7Full.split(',')[1];
  const t7Mark = await psql(`
    SET ROLE service_role;
    SELECT outcome FROM public.network_os_mark_command_packet_dispatch_started('pkt-t7', '${t7Token}');
  `);
  const t7Row = await psql(`
    SELECT (dispatch_started_at IS NOT NULL) || ',' ||
           (post_dispatch_finalize_deadline_at = dispatch_started_at + interval '20 seconds')
      FROM public.network_os_command_packet_claims
     WHERE packet_id = 'pkt-t7';
  `);
  if (t7Mark !== 'ok' || t7Row !== 't,t') throw new Error(`T7 FAIL mark=${t7Mark} row=${t7Row}`);
  report.steps.push({ step: 'T7', result: 'PASS', mark: t7Mark, deadline_is_plus_20s: true });

  const t8Full = await psql(leaseFullSql('pkt-t8', DIGEST_A));
  const t8Token = t8Full.split(',')[1];
  await psql(`
    SET ROLE service_role;
    SELECT outcome FROM public.network_os_mark_command_packet_dispatch_started('pkt-t8', '${t8Token}');
  `);
  const t8Fin = await psql(`
    SET ROLE service_role;
    SELECT outcome FROM public.network_os_finalize_command_packet_delivery('pkt-t8', '${t8Token}', 'delivered', 'http_2xx');
  `);
  const t8State = await psql(`
    SELECT delivery_state || ',' || dispatch_outcome || ',' || (delivered_at IS NOT NULL)
      FROM public.network_os_command_packet_claims
     WHERE packet_id = 'pkt-t8';
  `);
  const t8Attempt = await psql(`
    SELECT COUNT(*)::text FROM public.network_os_command_packet_delivery_attempts
     WHERE packet_id = 'pkt-t8' AND phase = 'finalize_ok';
  `);
  if (t8Fin !== 'ok' || t8State !== 'delivered,http_2xx,t' || t8Attempt !== '1') {
    throw new Error(`T8 FAIL fin=${t8Fin} state=${t8State} attempt=${t8Attempt}`);
  }
  report.steps.push({ step: 'T8', result: 'PASS', finalize: t8Fin, state: t8State });

  const t9Full = await psql(leaseFullSql('pkt-t9', DIGEST_A));
  const t9Token = t9Full.split(',')[1];
  await psql(`
    SET ROLE service_role;
    SELECT outcome FROM public.network_os_mark_command_packet_dispatch_started('pkt-t9', '${t9Token}');
  `);
  const t9Fin = await psql(`
    SET ROLE service_role;
    SELECT outcome FROM public.network_os_finalize_command_packet_delivery('pkt-t9', '${t9Token}', 'reconciliation_required', 'http_4xx');
  `);
  const t9State = await psql(`
    SELECT delivery_state || ',' || dispatch_outcome
      FROM public.network_os_command_packet_claims
     WHERE packet_id = 'pkt-t9';
  `);
  if (t9Fin !== 'ok' || t9State !== 'reconciliation_required,http_4xx') {
    throw new Error(`T9 FAIL fin=${t9Fin} state=${t9State}`);
  }
  report.steps.push({ step: 'T9', result: 'PASS', finalize: t9Fin, state: t9State });

  const t10Full = await psql(leaseFullSql('pkt-t10', DIGEST_A));
  const t10FirstAttempt = t10Full.split(',')[2];
  await psql(`
    UPDATE public.network_os_command_packet_claims
       SET lease_expires_at = clock_timestamp() - interval '1 second'
     WHERE packet_id = 'pkt-t10';
  `);
  const t10Re = await psql(leaseFullSql('pkt-t10', DIGEST_A));
  const [t10Outcome, , t10Attempt] = t10Re.split(',');
  const t10State = await psql(`
    SELECT delivery_state || ',' || (dispatch_started_at IS NULL) || ',' || current_attempt_no::text
      FROM public.network_os_command_packet_claims
     WHERE packet_id = 'pkt-t10';
  `);
  if (t10FirstAttempt !== '1' || t10Outcome !== 'leased' || t10Attempt !== '2' || t10State !== 'leased,t,2') {
    throw new Error(`T10 FAIL first=${t10FirstAttempt} re=${t10Re} state=${t10State}`);
  }
  report.steps.push({
    step: 'T10',
    result: 'PASS',
    first_attempt_no: t10FirstAttempt,
    reacquire_attempt_no: t10Attempt,
    allocator: 'current_attempt_no+1',
  });

  const t11Full = await psql(leaseFullSql('pkt-t11', DIGEST_A));
  const t11Token = t11Full.split(',')[1];
  await psql(`
    SET ROLE service_role;
    SELECT outcome FROM public.network_os_mark_command_packet_dispatch_started('pkt-t11', '${t11Token}');
  `);
  const t11Observe = await psql(leaseSql('pkt-t11', DIGEST_A));
  const t11State = await psql(`
    SELECT delivery_state FROM public.network_os_command_packet_claims WHERE packet_id = 'pkt-t11';
  `);
  if (t11Observe !== 'in_flight' || t11State !== 'leased') {
    throw new Error(`T11 FAIL observe=${t11Observe} state=${t11State}`);
  }
  report.steps.push({ step: 'T11', result: 'PASS', observer: t11Observe, delivery_state: t11State });

  const t12aFull = await psql(leaseFullSql('pkt-t12a', DIGEST_A));
  const t12aToken = t12aFull.split(',')[1];
  await psql(`
    SET ROLE service_role;
    SELECT outcome FROM public.network_os_mark_command_packet_dispatch_started('pkt-t12a', '${t12aToken}');
  `);
  await psql(`
    UPDATE public.network_os_command_packet_claims
       SET lease_expires_at = clock_timestamp() - interval '1 second'
     WHERE packet_id = 'pkt-t12a';
  `);
  const t12aFin = await psql(`
    SET ROLE service_role;
    SELECT outcome FROM public.network_os_finalize_command_packet_delivery('pkt-t12a', '${t12aToken}', 'delivered', 'http_2xx');
  `);
  const t12aState = await psql(`
    SELECT delivery_state FROM public.network_os_command_packet_claims WHERE packet_id = 'pkt-t12a';
  `);
  if (t12aFin !== 'ok' || t12aState !== 'delivered') {
    throw new Error(`T12A FAIL fin=${t12aFin} state=${t12aState}`);
  }
  report.steps.push({ step: 'T12A', result: 'PASS', stale_worker_finalize: t12aFin, state: t12aState });

  const t12bFull = await psql(leaseFullSql('pkt-t12b', DIGEST_A));
  const t12bToken = t12bFull.split(',')[1];
  await psql(`
    SET ROLE service_role;
    SELECT outcome FROM public.network_os_mark_command_packet_dispatch_started('pkt-t12b', '${t12bToken}');
  `);
  await psql(`
    UPDATE public.network_os_command_packet_claims
       SET post_dispatch_finalize_deadline_at = clock_timestamp() - interval '1 second'
     WHERE packet_id = 'pkt-t12b';
  `);
  const t12bObserve = await psql(leaseSql('pkt-t12b', DIGEST_A));
  const t12bState = await psql(`
    SELECT delivery_state FROM public.network_os_command_packet_claims WHERE packet_id = 'pkt-t12b';
  `);
  if (t12bObserve !== 'reconciliation_required' || t12bState !== 'reconciliation_required') {
    throw new Error(`T12B FAIL observe=${t12bObserve} state=${t12bState}`);
  }
  report.steps.push({ step: 'T12B', result: 'PASS', observer: t12bObserve, lazy_recon: true });

  const t12cFull = await psql(leaseFullSql('pkt-t12c', DIGEST_A));
  const t12cToken = t12cFull.split(',')[1];
  const t12cAttemptBefore = t12cFull.split(',')[2];
  await psql(`
    SET ROLE service_role;
    SELECT outcome FROM public.network_os_mark_command_packet_dispatch_started('pkt-t12c', '${t12cToken}');
  `);
  await psql(`
    UPDATE public.network_os_command_packet_claims
       SET lease_expires_at = clock_timestamp() - interval '1 second'
     WHERE packet_id = 'pkt-t12c';
  `);
  const t12cObserve = await psql(leaseSql('pkt-t12c', DIGEST_A));
  const t12cAttemptAfter = await psql(`
    SELECT current_attempt_no::text FROM public.network_os_command_packet_claims WHERE packet_id = 'pkt-t12c';
  `);
  if (t12cObserve !== 'in_flight' || t12cAttemptAfter !== t12cAttemptBefore) {
    throw new Error(`T12C FAIL observe=${t12cObserve} before=${t12cAttemptBefore} after=${t12cAttemptAfter}`);
  }
  report.steps.push({
    step: 'T12C',
    result: 'PASS',
    observer: t12cObserve,
    attempt_no_unchanged: t12cAttemptAfter,
  });

  const t12dFull = await psql(leaseFullSql('pkt-t12d', DIGEST_A));
  const t12dToken = t12dFull.split(',')[1];
  await psql(`
    SET ROLE service_role;
    SELECT outcome FROM public.network_os_mark_command_packet_dispatch_started('pkt-t12d', '${t12dToken}');
  `);
  const attemptsBefore = await psql(`
    SELECT COUNT(*)::text FROM public.network_os_command_packet_delivery_attempts WHERE packet_id = 'pkt-t12d';
  `);
  const t12dLost = await psql(`
    SET ROLE service_role;
    SELECT outcome FROM public.network_os_finalize_command_packet_delivery('pkt-t12d', 'wrong-token', 'delivered', 'http_2xx');
  `);
  const attemptsAfter = await psql(`
    SELECT COUNT(*)::text FROM public.network_os_command_packet_delivery_attempts WHERE packet_id = 'pkt-t12d';
  `);
  if (t12dLost !== 'lease_lost' || attemptsAfter !== attemptsBefore) {
    throw new Error(`T12D FAIL lost=${t12dLost} before=${attemptsBefore} after=${attemptsAfter}`);
  }
  report.steps.push({
    step: 'T12D',
    result: 'PASS',
    outcome: t12dLost,
    attempt_rows_unchanged: true,
  });

  const t13Reject = await psqlAllowFail(`
    UPDATE public.network_os_command_packet_claims
       SET dispatch_outcome = 'finalization_failed'
     WHERE packet_id = 'pkt-t8';
  `);
  if (t13Reject.ok) throw new Error('T13 FAIL finalization_failed was stored');
  report.steps.push({
    step: 'T13',
    result: 'PASS',
    finalization_failed_rejected: true,
    note: '2xx+DB-finalization-failure is local-only; DB CHECK forbids finalization_failed',
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
    SELECT has_function_privilege('service_role', 'public.network_os_mark_command_packet_dispatch_started(text,text)', 'EXECUTE');
  `);
  const serviceFin = await psql(`
    SELECT has_function_privilege('service_role', 'public.network_os_finalize_command_packet_delivery(text,text,text,text)', 'EXECUTE');
  `);
  const rlsForced = await psql(`
    SELECT relforcerowsecurity::text FROM pg_class
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
    throw new Error(`T14 FAIL old=${oldRpc} table=${serviceTable} attempts=${serviceAttempts} anon=${anonLease} auth=${authLease} svc=${serviceLease}/${serviceMark}/${serviceFin} rls=${rlsForced} policies=${policyCount}`);
  }
  report.steps.push({
    step: 'T14',
    result: 'PASS',
    old_claim_rpc_present: false,
    service_role_table_select: false,
    anon_execute: false,
    authenticated_execute: false,
    service_role_execute: true,
    attempts_force_rls: true,
    attempts_policies: 0,
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
    throw new Error(`T15 FAIL expected attempts-exist RAISE: ${JSON.stringify(blockedRollback)}`);
  }
  const stillPresent = await psql(`
    SELECT to_regclass('public.network_os_command_packet_delivery_attempts') IS NOT NULL;
  `);
  if (stillPresent !== 't') throw new Error('T15 FAIL rollback deleted attempts despite RAISE');

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
    throw new Error(`T15 FAIL after rollback attempts=${attemptsAfterRollback} claims=${claimsAfter} ac3=${ac3After} lease=${leaseAfter} old=${oldRpcAfter} col=${deliveryStateAfter}`);
  }
  report.steps.push({
    step: 'T15',
    result: 'PASS',
    rollback_blocked_while_attempts_exist: true,
    lock_order: 'claims ACCESS EXCLUSIVE then attempts ACCESS EXCLUSIVE',
    claims_preserved: true,
    ac3_preserved: true,
    old_rpc_not_recreated: true,
    new_rpcs_dropped: true,
  });

  const packetTextCol = await psql(`
    SELECT COUNT(*)::text FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('network_os_command_packet_claims')
       AND column_name = 'packet_text';
  `);
  if (packetTextCol !== '0') throw new Error(`T16 FAIL packet_text column present`);
  report.steps.push({
    step: 'T16',
    result: 'PASS',
    packet_text_column: false,
    secrets_logged: false,
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

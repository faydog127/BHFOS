#!/usr/bin/env node
/**
 * Disposable-local PostgreSQL proof for NOS-N8N-COMMAND-PACKET-CLAIM-CONTRACT-01.
 * Apply → contract/concurrency → rollback → objects absent. No hosted apply.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION = path.join(root, 'supabase/migrations/20260830050000_network_os_command_packet_claims.sql');
const ROLLBACK = path.join(root, 'supabase/rollbacks/20260830050000_network_os_command_packet_claims.sql');
const HOST = '127.0.0.1';
const PORT = process.env.NOS_CLAIM_PG_PORT || '55433';
const DB = 'nos_command_packet_claim_proof';
const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
const EVENT_TYPE = 'command.packet.submitted';
const SOURCE = 'bhfos-command-center';

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nos-command-packet-claim-'));
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

async function psql(sql, extraArgs = []) {
  const result = await run(`${pgBin}/psql`, [
    '-h',
    HOST,
    '-p',
    PORT,
    '-d',
    DB,
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

function claimSql(packetId, digest) {
  return `SET ROLE service_role; SELECT public.network_os_claim_command_packet('${packetId}', '${digest}', '${EVENT_TYPE}', '${SOURCE}');`;
}

async function concurrentClaims(packetId, digest, count) {
  const results = await Promise.all(
    Array.from({ length: count }, () =>
      psql(claimSql(packetId, digest)).catch((error) => `ERROR:${error.message}`),
    ),
  );
  const tallies = { claimed: 0, duplicate: 0, conflict: 0, other: 0 };
  for (const row of results) {
    if (row === 'claimed') tallies.claimed += 1;
    else if (row === 'duplicate') tallies.duplicate += 1;
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
  await psql(`
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
  `);
  await psql('SELECT 1;', ['-f', MIGRATION]);
  report.steps.push({ step: 'apply', result: 'ok', migration: MIGRATION });

  const tablePresent = await psql("SELECT to_regclass('public.network_os_command_packet_claims') IS NOT NULL;");
  const rpcPresent = await psql("SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'network_os_claim_command_packet');");
  const pr154Table = await psql("SELECT to_regclass('public.network_os_assurance_delivery_claims') IS NOT NULL;");
  const pr154Rpc = await psql("SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'network_os_claim_assurance_delivery');");
  if (tablePresent !== 't' || rpcPresent !== 't') throw new Error('claim table or RPC missing after apply');
  if (pr154Table !== 'f' || pr154Rpc !== 'f') throw new Error('PR 154 objects appeared; isolation failed');
  report.steps.push({
    step: 'ac1_isolation',
    command_packet_table: tablePresent,
    command_packet_rpc: rpcPresent,
    assurance_table: pr154Table,
    assurance_rpc: pr154Rpc,
  });

  const first = await psql(claimSql('pkt-local-first', DIGEST_A));
  const second = await psql(claimSql('pkt-local-first', DIGEST_A));
  if (first !== 'claimed' || second !== 'duplicate') {
    throw new Error(`sequential claim failed: first=${first} second=${second}`);
  }
  report.steps.push({ step: 'ac2_ac3_sequential', first, second });

  const concurrent = await concurrentClaims('pkt-local-concurrent-25', DIGEST_A, 25);
  if (concurrent.tallies.claimed !== 1 || concurrent.tallies.duplicate !== 24 || concurrent.tallies.other !== 0) {
    throw new Error(`AC-4 FAIL tallies=${JSON.stringify(concurrent.tallies)}`);
  }
  report.steps.push({ step: 'ac4_concurrency', tallies: concurrent.tallies, winner_count: concurrent.tallies.claimed });

  const conflict = await psql(claimSql('pkt-local-first', DIGEST_B));
  if (conflict !== 'conflict') throw new Error(`AC-5 FAIL conflict=${conflict}`);
  report.steps.push({ step: 'ac5_conflict', result: conflict });

  const serviceTable = await psql(`
    SET ROLE service_role;
    SELECT has_table_privilege('service_role', 'public.network_os_command_packet_claims', 'SELECT');
  `);
  const anonExec = await psql(`
    SELECT has_function_privilege('anon', 'public.network_os_claim_command_packet(text,text,text,text)', 'EXECUTE');
  `);
  const authExec = await psql(`
    SELECT has_function_privilege('authenticated', 'public.network_os_claim_command_packet(text,text,text,text)', 'EXECUTE');
  `);
  const serviceExec = await psql(`
    SELECT has_function_privilege('service_role', 'public.network_os_claim_command_packet(text,text,text,text)', 'EXECUTE');
  `);
  if (serviceTable !== 'f' || anonExec !== 'f' || authExec !== 'f' || serviceExec !== 't') {
    throw new Error(`privilege matrix failed table=${serviceTable} anon=${anonExec} auth=${authExec} service=${serviceExec}`);
  }
  report.steps.push({
    step: 'privileges',
    service_role_table_select: serviceTable,
    anon_execute: anonExec,
    authenticated_execute: authExec,
    service_role_execute: serviceExec,
  });

  await psql('SELECT 1;', ['-f', ROLLBACK]);
  const tableAfter = await psql("SELECT to_regclass('public.network_os_command_packet_claims') IS NOT NULL;");
  const rpcAfter = await psql("SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'network_os_claim_command_packet');");
  if (tableAfter !== 'f' || rpcAfter !== 'f') {
    throw new Error(`AC-10 FAIL after rollback table=${tableAfter} rpc=${rpcAfter}`);
  }
  report.steps.push({ step: 'ac10_rollback', table_present: tableAfter, rpc_present: rpcAfter });

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

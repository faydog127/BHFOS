/**
 * Local PostgREST probe for deliberate finance version conflicts.
 * Requires a loopback API and database, an empty finance_plans table, and the
 * synthetic admin created by the finance release gate. Deletes only the rows
 * this process inserts. Does not print keys, passwords, or database URLs.
 */
import { execFileSync } from 'node:child_process';
import { blankPlanInputs } from '../src/lib/finance/blankPlan.js';

const APPROVE_NOTE = 'pt409-approve-probe';
const UPGRADE_NOTE = 'pt409-upgrade-probe';
const HANG_MS = 5000;
const api = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.FINANCE_CHECKIN_EMAIL;
const password = process.env.FINANCE_CHECKIN_PASSWORD;
const db = process.env.FINANCE_LOCAL_DB_URL;

function isLoopback(value) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === '127.0.0.1' || hostname === 'localhost';
  } catch {
    return false;
  }
}

function redact(text) {
  return String(text || '').replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]');
}

function psql(sql) {
  try {
    return execFileSync('psql', [db, '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const detail = redact(error.stderr || error.message);
    throw new Error(`local psql failed (${error.status ?? 'unknown'}): ${detail.slice(0, 240)}`);
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
}

function snapshot(row) {
  return {
    version: row.version,
    status: row.status,
    schema_version: row.schema_version,
    approved_at: row.approved_at,
    approved_by: row.approved_by,
    notes: row.notes,
    inputs: stable(row.inputs),
  };
}

function sameSnapshot(left, right) {
  return JSON.stringify(snapshot(left)) === JSON.stringify(snapshot(right));
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: 'unparsed' };
  }
}

function authHeaders(token) {
  return {
    apikey: anon,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function callRpc(token, name, body) {
  const started = performance.now();
  const response = await fetch(`${api}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { ...authHeaders(token), Prefer: 'return=representation' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const elapsed = Math.round(performance.now() - started);
  const payload = await readJson(response);
  return { status: response.status, elapsed, payload };
}

function logCall(name, label, result, extra = '') {
  const code = result.payload && typeof result.payload === 'object' && !Array.isArray(result.payload)
    ? result.payload.code || ''
    : '';
  console.log(`HTTP ${name} ${label} status=${result.status} elapsed_ms=${result.elapsed} code=${code}${extra}`);
}

function identifierPresent(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return ['message', 'details', 'hint'].every((key) => payload[key] === 'finance_version_conflict');
}

async function insertPlan(token, row) {
  const started = performance.now();
  const response = await fetch(`${api}/rest/v1/finance_plans`, {
    method: 'POST',
    headers: { ...authHeaders(token), Prefer: 'return=representation' },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(8000),
  });
  const elapsed = Math.round(performance.now() - started);
  const payload = await readJson(response);
  const created = Array.isArray(payload) ? payload[0] : null;
  if (response.status !== 201 || !created?.id) {
    const code = payload && payload.code ? payload.code : '';
    throw new Error(`insert failed status=${response.status} elapsed_ms=${elapsed} code=${code}`);
  }
  console.log(`HTTP finance_plans insert status=${response.status} elapsed_ms=${elapsed}`);
  return created;
}

async function readPlan(token, id) {
  const response = await fetch(
    `${api}/rest/v1/finance_plans?id=eq.${id}&select=id,version,status,schema_version,inputs,notes,approved_at,approved_by`,
    { headers: authHeaders(token), signal: AbortSignal.timeout(8000) },
  );
  const payload = await readJson(response);
  if (response.status !== 200 || !Array.isArray(payload) || payload.length !== 1) {
    throw new Error(`read failed status=${response.status}`);
  }
  return payload[0];
}

function assertQuick(result, label) {
  if (result.elapsed >= HANG_MS) {
    throw new Error(`${label} took ${result.elapsed}ms`);
  }
}

if (!api || !anon || !email || !password || !db) {
  console.error('Missing local finance probe environment. Refusing to continue.');
  process.exit(1);
}
if (!isLoopback(api) || !isLoopback(db)) {
  console.error('Refusing to run the finance version-conflict probe against a non-local URL.');
  process.exit(1);
}

let exitCode = 0;
try {
  const before = psql('select count(*) from public.finance_plans');
  if (before !== '0') {
    throw new Error(`finance_plans is not empty (${before}). Reset the local database before this probe.`);
  }

  const session = await fetch(`${api}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(8000),
  });
  const sessionBody = await readJson(session);
  if (!session.ok || !sessionBody?.access_token) {
    throw new Error(`synthetic sign-in failed with HTTP ${session.status}`);
  }
  const token = sessionBody.access_token;

  const ordinary = await callRpc(token, 'finance_open_draft', {
    p_plan_id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  });
  logCall('finance_open_draft', 'ordinary', ordinary);
  assertQuick(ordinary, 'finance_open_draft ordinary');
  if (ordinary.status === 409 || ordinary.status < 400 || ordinary.status >= 500) {
    throw new Error(`finance_open_draft ordinary returned HTTP ${ordinary.status}`);
  }
  if (ordinary.payload?.code !== '02000' && ordinary.payload?.message !== 'finance_no_approved_plan') {
    throw new Error('finance_open_draft ordinary did not return finance_no_approved_plan');
  }

  const approvedInputs = { ...blankPlanInputs(), monthly_basis: {} };
  const draft = await insertPlan(token, {
    tenant_id: 'tvg',
    status: 'draft',
    schema_version: 2,
    inputs: approvedInputs,
    notes: APPROVE_NOTE,
  });
  const approveBefore = await readPlan(token, draft.id);
  const staleApprove = await callRpc(token, 'finance_approve_plan', {
    p_plan_id: draft.id,
    p_expected_version: 0,
  });
  logCall('finance_approve_plan', 'stale', staleApprove, ` identifier=${identifierPresent(staleApprove.payload)}`);
  assertQuick(staleApprove, 'finance_approve_plan stale');
  if (staleApprove.status !== 409 || staleApprove.payload?.code !== 'PT409' || !identifierPresent(staleApprove.payload)) {
    throw new Error(`finance_approve_plan stale returned HTTP ${staleApprove.status}`);
  }
  const approveAfter = await readPlan(token, draft.id);
  if (!sameSnapshot(approveBefore, approveAfter)) {
    throw new Error('finance_approve_plan stale changed the plan row');
  }
  console.log('HTTP finance_approve_plan stale unchanged=true');

  const validApprove = await callRpc(token, 'finance_approve_plan', {
    p_plan_id: draft.id,
    p_expected_version: approveBefore.version,
  });
  logCall('finance_approve_plan', 'valid', validApprove);
  assertQuick(validApprove, 'finance_approve_plan valid');
  const approvedRow = validApprove.payload && !Array.isArray(validApprove.payload) ? validApprove.payload : null;
  if (validApprove.status !== 200 || approvedRow?.status !== 'approved' || approvedRow?.notes !== APPROVE_NOTE) {
    throw new Error(`finance_approve_plan valid returned HTTP ${validApprove.status}`);
  }
  if (!(approvedRow.version > approveBefore.version) || !approvedRow.approved_at || !approvedRow.approved_by) {
    throw new Error('finance_approve_plan valid did not stamp approval');
  }

  const upgradeDraft = await insertPlan(token, {
    tenant_id: 'tvg',
    status: 'draft',
    schema_version: 1,
    inputs: blankPlanInputs(),
    notes: UPGRADE_NOTE,
  });
  const upgradeBefore = await readPlan(token, upgradeDraft.id);
  const staleUpgrade = await callRpc(token, 'finance_upgrade_draft_schema', {
    p_plan_id: upgradeDraft.id,
    p_expected_version: 0,
  });
  logCall('finance_upgrade_draft_schema', 'stale', staleUpgrade, ` identifier=${identifierPresent(staleUpgrade.payload)}`);
  assertQuick(staleUpgrade, 'finance_upgrade_draft_schema stale');
  if (staleUpgrade.status !== 409 || staleUpgrade.payload?.code !== 'PT409' || !identifierPresent(staleUpgrade.payload)) {
    throw new Error(`finance_upgrade_draft_schema stale returned HTTP ${staleUpgrade.status}`);
  }
  const upgradeAfter = await readPlan(token, upgradeDraft.id);
  if (!sameSnapshot(upgradeBefore, upgradeAfter)) {
    throw new Error('finance_upgrade_draft_schema stale changed the plan row');
  }
  console.log('HTTP finance_upgrade_draft_schema stale unchanged=true');

  const validUpgrade = await callRpc(token, 'finance_upgrade_draft_schema', {
    p_plan_id: upgradeDraft.id,
    p_expected_version: upgradeBefore.version,
  });
  logCall('finance_upgrade_draft_schema', 'valid', validUpgrade);
  assertQuick(validUpgrade, 'finance_upgrade_draft_schema valid');
  const upgradedRow = validUpgrade.payload && !Array.isArray(validUpgrade.payload) ? validUpgrade.payload : null;
  if (validUpgrade.status !== 200 || upgradedRow?.schema_version !== 2 || upgradedRow?.status !== 'draft' || upgradedRow?.notes !== UPGRADE_NOTE) {
    throw new Error(`finance_upgrade_draft_schema valid returned HTTP ${validUpgrade.status}`);
  }
  if (upgradedRow.approved_at || upgradedRow.approved_by || !(upgradedRow.version > upgradeBefore.version)) {
    throw new Error('finance_upgrade_draft_schema valid changed approval or skipped the version bump');
  }
  if (!upgradedRow.inputs || upgradedRow.inputs.monthly_basis === undefined) {
    throw new Error('finance_upgrade_draft_schema valid omitted monthly_basis');
  }
} catch (error) {
  exitCode = 1;
  console.error(redact(error.message || 'finance version-conflict probe failed'));
} finally {
  try {
    psql(`delete from public.finance_plans where notes in ('${APPROVE_NOTE}', '${UPGRADE_NOTE}')`);
    const after = psql('select count(*) from public.finance_plans');
    if (after !== '0') {
      console.error(`finance_plans cleanup left ${after} row(s)`);
      exitCode = 1;
    }
  } catch (error) {
    exitCode = 1;
    console.error(redact(error.message || 'finance version-conflict cleanup failed'));
  }
}

process.exit(exitCode);

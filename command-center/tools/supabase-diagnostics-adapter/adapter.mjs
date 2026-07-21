/**
 * Supabase Diagnostics Adapter — G2.3B-B2D (corrected)
 *
 * Bounded read facade for Production Diagnostics. Hard endpoint allowlist.
 * Project isolation is adapter-enforced for fixed production ref only.
 * OAuth access token is NOT claimed to be project-scoped at the token layer.
 *
 * Credential values (when authorized later) stay in process env and are never
 * returned to the Cursor agent. Agent cannot supply URL, path, query, project
 * ref, or HTTP method that bypasses the allowlist.
 *
 * Usage:
 *   node tools/supabase-diagnostics-adapter/cli.mjs --help
 *   node tools/supabase-diagnostics-adapter/cli.mjs --self-test
 *   node tools/supabase-diagnostics-adapter/cli.mjs project-status
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const allowlistPath = path.join(here, 'allowlist.json');

/** Hard-coded production project ref — adapter isolation boundary (not token ACL). */
export const PRODUCTION_PROJECT_REF = 'wwyxohjnyqnegzbxtuxs';

/**
 * Adapter-owned fixed query for project_health only.
 * Management API GET /v1/projects/{ref}/health requires `services` (array enum).
 * Never accept agent-supplied query strings.
 */
export const PROJECT_HEALTH_FIXED_QUERY = 'services=db&services=auth&services=rest';

export function loadAllowlist() {
  return JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
}

/**
 * Resolve the only project ref the adapter may use.
 * Env SUPABASE_DIAGNOSTICS_PROJECT_REF must match PRODUCTION_PROJECT_REF when set.
 * Agent-supplied refs are rejected when they do not match the lock.
 */
export function resolveProductionProjectRef({ agentRef } = {}) {
  const list = loadAllowlist();
  const expected = list.production_project_ref || PRODUCTION_PROJECT_REF;
  if (expected !== PRODUCTION_PROJECT_REF) {
    throw new Error(
      `DENY: allowlist production_project_ref mismatch (expected ${PRODUCTION_PROJECT_REF})`
    );
  }

  const envRef = process.env.SUPABASE_DIAGNOSTICS_PROJECT_REF;
  if (envRef && envRef !== PRODUCTION_PROJECT_REF) {
    throw new Error(
      `DENY: SUPABASE_DIAGNOSTICS_PROJECT_REF must be ${PRODUCTION_PROJECT_REF}`
    );
  }

  if (agentRef !== undefined && agentRef !== null && agentRef !== '') {
    if (agentRef !== PRODUCTION_PROJECT_REF) {
      throw new Error(
        `DENY: agent-supplied project ref rejected (adapter locked to ${PRODUCTION_PROJECT_REF})`
      );
    }
  }

  return PRODUCTION_PROJECT_REF;
}

/** Build request path; throws if not allowlisted. Ref is never taken from agent alone. */
export function resolveAllowedPath(operation, { agentRef } = {}) {
  const list = loadAllowlist();
  const op = list.operations[operation];
  if (!op) {
    throw new Error(`DENY: unknown operation "${operation}"`);
  }
  if (op.status === 'unavailable' || op.status === 'deferred') {
    throw new Error(`DENY: operation "${operation}" is ${op.status}: ${op.reason || ''}`);
  }
  if (op.method !== 'GET') {
    throw new Error(`DENY: method ${op.method} not permitted`);
  }

  const ref = resolveProductionProjectRef({ agentRef });
  let built = op.pathTemplate.replace('{ref}', ref);
  if (operation === 'project_health') {
    built = `${built}?${PROJECT_HEALTH_FIXED_QUERY}`;
  }

  const pathOnly = built.split('?')[0];

  if (list.prohibited_exact_paths?.includes(pathOnly)) {
    throw new Error(`DENY: exact path prohibited: ${pathOnly}`);
  }

  const exactOk = Object.values(list.operations).some(
    (o) => o.status === 'allowed' && o.pathTemplate.replace('{ref}', ref) === pathOnly
  );
  if (!exactOk) {
    throw new Error(`DENY: path not on allowlist: ${pathOnly}`);
  }

  assertNotProhibited(built);
  return { method: 'GET', path: built, operation, ref };
}

/** Paths that must never be requested. */
export function assertNotProhibited(requestPath) {
  const list = loadAllowlist();
  const raw = String(requestPath);
  const qIdx = raw.indexOf('?');
  const pathOnly = qIdx === -1 ? raw : raw.slice(0, qIdx);
  const query = qIdx === -1 ? '' : raw.slice(qIdx + 1);

  if (list.prohibited_exact_paths?.includes(pathOnly)) {
    throw new Error(`DENY: exact path prohibited: ${pathOnly}`);
  }

  if (pathOnly === '/v1/projects' || pathOnly === '/v1/projects/') {
    throw new Error('DENY: project listing prohibited');
  }

  for (const pattern of list.prohibited_path_substrings) {
    if (raw.includes(pattern)) {
      throw new Error(`DENY: prohibited path pattern "${pattern}" in ${requestPath}`);
    }
  }

  if (qIdx !== -1) {
    const allowedHealthPath = `/v1/projects/${PRODUCTION_PROJECT_REF}/health`;
    if (pathOnly === allowedHealthPath && query === PROJECT_HEALTH_FIXED_QUERY) {
      return;
    }
    throw new Error('DENY: query strings are not permitted on adapter requests');
  }
}

/**
 * Mask / redact obvious secret-shaped strings from adapter output.
 * Does not claim complete PII scrubbing.
 */
export function maskPayload(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s
    .replace(/ghp_[A-Za-z0-9_]+/g, '[REDACTED]')
    .replace(/github_pat_[A-Za-z0-9_]+/g, '[REDACTED]')
    .replace(/sbp_[A-Za-z0-9_]+/g, '[REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
}

function readAccessToken() {
  const token = process.env.I2_SUPABASE_OAUTH_ACCESS_TOKEN;
  if (token) return token;
  if (process.env.SUPABASE_DIAGNOSTICS_ADAPTER_TOKEN) {
    throw new Error(
      'DENY: SUPABASE_DIAGNOSTICS_ADAPTER_TOKEN is retired; use I2_SUPABASE_OAUTH_ACCESS_TOKEN'
    );
  }
  return null;
}

/**
 * Perform allowlisted GET. Credential from I2_SUPABASE_OAUTH_ACCESS_TOKEN only —
 * never accepted as a CLI argument. Ref is adapter-locked.
 */
export async function invokeAllowlisted(operation, { agentRef, dryRun = false } = {}) {
  const { method, path: apiPath, ref } = resolveAllowedPath(operation, { agentRef });

  if (dryRun || process.env.SUPABASE_ADAPTER_DRY_RUN === '1') {
    return {
      dry_run: true,
      operation,
      method,
      path: apiPath,
      ref,
      note: 'No network call; credential not required in dry-run',
    };
  }

  const token = readAccessToken();
  if (!token) {
    throw new Error(
      'DENY: I2_SUPABASE_OAUTH_ACCESS_TOKEN not set (credential not issued under G2.3B-B2D)'
    );
  }

  const base = (process.env.SUPABASE_MANAGEMENT_API_BASE || 'https://api.supabase.com').replace(
    /\/$/,
    ''
  );
  const url = `${base}${apiPath}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: maskPayload(text.slice(0, 2000)) };
  }

  return {
    operation,
    status: res.status,
    ok: res.ok,
    ref,
    body: JSON.parse(maskPayload(typeof body === 'string' ? body : JSON.stringify(body))),
  };
}

export function selfTest() {
  const results = [];
  const goodRef = PRODUCTION_PROJECT_REF;
  const badRef = 'abcdefghijklmnopqrst';
  const list = loadAllowlist();

  results.push({
    test: 'allowlist_health_fixed_query_matches_constant',
    pass:
      list.operations?.project_health?.fixedQuery === PROJECT_HEALTH_FIXED_QUERY,
  });

  try {
    const r = resolveAllowedPath('project_status', {});
    results.push({
      test: 'allow_project_status',
      pass:
        r.ref === goodRef &&
        r.path === `/v1/projects/${goodRef}` &&
        r.method === 'GET' &&
        !r.path.includes('?'),
      path: r.path,
    });
  } catch (e) {
    results.push({ test: 'allow_project_status', pass: false, error: String(e.message || e) });
  }

  try {
    const r = resolveAllowedPath('project_health', {});
    const expected = `/v1/projects/${goodRef}/health?${PROJECT_HEALTH_FIXED_QUERY}`;
    results.push({
      test: 'allow_project_health_fixed_query',
      pass: r.ref === goodRef && r.path === expected && r.method === 'GET',
      path: r.path,
    });
  } catch (e) {
    results.push({
      test: 'allow_project_health_fixed_query',
      pass: false,
      error: String(e.message || e),
    });
  }

  try {
    assertNotProhibited(`/v1/projects/${goodRef}/health?services=storage`);
    results.push({ test: 'deny_agent_health_query', pass: false, error: 'expected deny' });
  } catch (e) {
    results.push({
      test: 'deny_agent_health_query',
      pass: /DENY/.test(String(e.message || e)),
    });
  }

  try {
    assertNotProhibited(`/v1/projects/${goodRef}?foo=bar`);
    results.push({ test: 'deny_arbitrary_query', pass: false, error: 'expected deny' });
  } catch (e) {
    results.push({
      test: 'deny_arbitrary_query',
      pass: /DENY/.test(String(e.message || e)),
    });
  }

  try {
    assertNotProhibited(
      `/v1/projects/${goodRef}/health?${PROJECT_HEALTH_FIXED_QUERY}`
    );
    results.push({ test: 'allow_fixed_health_query_assert', pass: true });
  } catch (e) {
    results.push({
      test: 'allow_fixed_health_query_assert',
      pass: false,
      error: String(e.message || e),
    });
  }

  try {
    resolveAllowedPath('edge_function_inventory', {});
    results.push({ test: 'deny_edge_inventory', pass: false, error: 'expected deny' });
  } catch (e) {
    results.push({
      test: 'deny_edge_inventory',
      pass: /DENY/.test(String(e.message || e)),
      error: String(e.message || e),
    });
  }

  try {
    resolveAllowedPath('project_status', { agentRef: badRef });
    results.push({ test: 'deny_agent_ref', pass: false, error: 'expected deny' });
  } catch (e) {
    results.push({
      test: 'deny_agent_ref',
      pass: /DENY/.test(String(e.message || e)),
    });
  }

  try {
    const r = resolveAllowedPath('project_status', { agentRef: goodRef });
    results.push({ test: 'allow_matching_agent_ref', pass: r.ref === goodRef });
  } catch (e) {
    results.push({ test: 'allow_matching_agent_ref', pass: false, error: String(e.message || e) });
  }

  try {
    resolveAllowedPath('migration_list', {});
    results.push({ test: 'deny_migration_list', pass: false, error: 'expected deny' });
  } catch (e) {
    results.push({
      test: 'deny_migration_list',
      pass: /DENY/.test(String(e.message || e)),
    });
  }

  const prohibited = [
    '/v1/projects',
    '/v1/projects/',
    `/v1/projects/${goodRef}/functions/foo/body`,
    `/v1/projects/${goodRef}/secrets`,
    `/v1/projects/${goodRef}/api-keys`,
    `/v1/projects/${goodRef}/database/query`,
    `/v1/projects/${goodRef}/network-restrictions`,
    `/v1/projects/${goodRef}/analytics/endpoints/logs?sql=SELECT%201`,
    '/v1/organizations/x/projects',
  ];
  for (const p of prohibited) {
    try {
      assertNotProhibited(p);
      results.push({ test: `prohibit_${p}`, pass: false, error: 'expected deny' });
    } catch (e) {
      results.push({
        test: 'prohibit_path',
        path: p,
        pass: /DENY/.test(String(e.message || e)),
      });
    }
  }

  try {
    resolveAllowedPath('custom_log_sql', {});
    results.push({ test: 'deny_custom_log_sql', pass: false });
  } catch (e) {
    results.push({
      test: 'deny_custom_log_sql',
      pass: /DENY|unknown/.test(String(e.message || e)),
    });
  }

  return invokeAllowlisted('project_status', { dryRun: true }).then((out) => {
    const serialized = JSON.stringify(out);
    results.push({
      test: 'dry_run_no_token_echo',
      pass: !/I2_SUPABASE_OAUTH_|SUPABASE_DIAGNOSTICS_ADAPTER_TOKEN|Bearer\s+\S+/.test(
        serialized
      ),
    });
    results.push({
      test: 'dry_run_locked_ref',
      pass: out.ref === goodRef && out.path === `/v1/projects/${goodRef}`,
    });
    return invokeAllowlisted('project_health', { dryRun: true }).then((healthOut) => {
      results.push({
        test: 'dry_run_project_health_fixed_query',
        pass:
          healthOut.ref === goodRef &&
          healthOut.path ===
            `/v1/projects/${goodRef}/health?${PROJECT_HEALTH_FIXED_QUERY}`,
      });
      const failed = results.filter((r) => !r.pass);
      return { ok: failed.length === 0, results, failed };
    });
  });
}

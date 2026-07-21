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
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  CATALOG_OPERATIONS,
  READ_ONLY_QUERY_PATH_SUFFIX,
  listCatalogOperations,
  resolveCatalogSql,
} from './catalog-ops.mjs';

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
export function assertNotProhibited(requestPath, { allowCatalogReadOnly = false } = {}) {
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

  const readOnlyPath = `/v1/projects/${PRODUCTION_PROJECT_REF}${READ_ONLY_QUERY_PATH_SUFFIX}`;
  const writableQueryPath = `/v1/projects/${PRODUCTION_PROJECT_REF}/database/query`;

  if (pathOnly === writableQueryPath || pathOnly.startsWith(`${writableQueryPath}?`)) {
    throw new Error('DENY: writable database/query endpoint is prohibited');
  }

  if (pathOnly.includes('/database')) {
    if (allowCatalogReadOnly && pathOnly === readOnlyPath && qIdx === -1) {
      // permitted only for catalog transport
    } else {
      throw new Error(`DENY: database path not permitted: ${pathOnly}`);
    }
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
 * Append audit record (no secrets, no row payloads).
 * @param {object} entry
 */
export function appendAuditLog(entry) {
  const defaultDir =
    process.env.LOCALAPPDATA ||
    process.env.HOME ||
    process.env.USERPROFILE ||
    '';
  const fallback = defaultDir
    ? path.join(defaultDir, 'BHFOS', 'production-diagnostics', 'adapter-audit.jsonl')
    : '';
  const auditPath = process.env.I2_DIAGNOSTICS_AUDIT_LOG || fallback;
  if (!auditPath) return { audited: false, reason: 'no_audit_path' };

  const line = JSON.stringify({
    ts_utc: new Date().toISOString(),
    caller: 'supabase-diagnostics-adapter',
    ref: PRODUCTION_PROJECT_REF,
    ...entry,
  });
  try {
    fs.mkdirSync(path.dirname(auditPath), { recursive: true });
    fs.appendFileSync(auditPath, `${line}\n`, { encoding: 'utf8' });
    return { audited: true, path: auditPath };
  } catch (e) {
    return { audited: false, reason: String(e.message || e) };
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

/**
 * Bounded catalog-metadata invoke.
 * Agent supplies operation id + structured params only — never SQL.
 */
export async function invokeCatalog(operationId, rawParams = {}, { agentRef, dryRun = false } = {}) {
  const ref = resolveProductionProjectRef({ agentRef });
  const apiPath = `/v1/projects/${ref}${READ_ONLY_QUERY_PATH_SUFFIX}`;
  assertNotProhibited(apiPath, { allowCatalogReadOnly: true });

  let resolved;
  try {
    resolved = resolveCatalogSql(operationId, rawParams, {
      sql: rawParams.sql,
      query: rawParams.query,
    });
  } catch (e) {
    appendAuditLog({
      operation: operationId,
      params: sanitizeParamsForAudit(rawParams),
      result_class: 'deny',
      error: String(e.message || e),
    });
    throw e;
  }

  if (dryRun || process.env.SUPABASE_ADAPTER_DRY_RUN === '1') {
    appendAuditLog({
      operation: resolved.operation,
      params: resolved.params,
      result_class: 'dry_run',
      path: apiPath,
    });
    return {
      dry_run: true,
      operation: resolved.operation,
      method: 'POST',
      path: apiPath,
      ref,
      params: resolved.params,
      description: resolved.description,
      sql_sha256: sha256Hex(resolved.sql),
      note: 'No network call; fixed SQL not returned to reduce prompt leakage',
    };
  }

  const token = readAccessToken();
  if (!token) {
    appendAuditLog({
      operation: resolved.operation,
      params: resolved.params,
      result_class: 'error',
      error: 'missing_oauth_token',
    });
    throw new Error(
      'DENY: I2_SUPABASE_OAUTH_ACCESS_TOKEN not set (catalog live calls require database_read-scoped token)'
    );
  }

  const base = (process.env.SUPABASE_MANAGEMENT_API_BASE || 'https://api.supabase.com').replace(
    /\/$/,
    ''
  );
  const url = `${base}${apiPath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: resolved.sql }),
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: maskPayload(text.slice(0, 2000)) };
  }

  const masked = JSON.parse(maskPayload(typeof body === 'string' ? body : JSON.stringify(body)));
  const resultClass = res.ok ? 'ok' : 'error';
  appendAuditLog({
    operation: resolved.operation,
    params: resolved.params,
    result_class: resultClass,
    http_status: res.status,
    path: apiPath,
  });

  return {
    operation: resolved.operation,
    status: res.status,
    ok: res.ok,
    ref,
    params: resolved.params,
    description: resolved.description,
    classification: 'catalog_metadata',
    body: masked,
  };
}

function sanitizeParamsForAudit(rawParams) {
  const out = {};
  for (const [k, v] of Object.entries(rawParams || {})) {
    if (k === 'sql' || k === 'query') {
      out[k] = '[REJECTED]';
      continue;
    }
    out[k] = typeof v === 'string' ? v.slice(0, 80) : v;
  }
  return out;
}

function sha256Hex(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}

export { listCatalogOperations, CATALOG_OPERATIONS };

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
    `/v1/projects/${goodRef}/database/migrations`,
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

  // read-only query path denied unless catalog flag set
  try {
    assertNotProhibited(`/v1/projects/${goodRef}${READ_ONLY_QUERY_PATH_SUFFIX}`);
    results.push({ test: 'deny_readonly_query_without_flag', pass: false });
  } catch (e) {
    results.push({
      test: 'deny_readonly_query_without_flag',
      pass: /DENY/.test(String(e.message || e)),
    });
  }
  try {
    assertNotProhibited(`/v1/projects/${goodRef}${READ_ONLY_QUERY_PATH_SUFFIX}`, {
      allowCatalogReadOnly: true,
    });
    results.push({ test: 'allow_readonly_query_with_flag', pass: true });
  } catch (e) {
    results.push({
      test: 'allow_readonly_query_with_flag',
      pass: false,
      error: String(e.message || e),
    });
  }

  // Catalog: deny agent SQL
  try {
    resolveCatalogSql('catalog_rls_flags', { schema: 'public', table: 'estimates', sql: 'SELECT 1' });
    results.push({ test: 'deny_agent_sql_param', pass: false });
  } catch (e) {
    results.push({
      test: 'deny_agent_sql_param',
      pass: /agent-supplied SQL/i.test(String(e.message || e)),
    });
  }

  try {
    resolveCatalogSql('catalog_rls_flags', { schema: 'public', table: 'estimates; DROP TABLE x' });
    results.push({ test: 'deny_ident_injection', pass: false });
  } catch (e) {
    results.push({
      test: 'deny_ident_injection',
      pass: /DENY/.test(String(e.message || e)),
    });
  }

  try {
    const r = resolveCatalogSql('catalog_rls_flags', { schema: 'public', table: 'estimates' });
    results.push({
      test: 'allow_catalog_rls_template',
      pass: r.sql.startsWith('SELECT') && r.params.table === 'estimates',
    });
  } catch (e) {
    results.push({
      test: 'allow_catalog_rls_template',
      pass: false,
      error: String(e.message || e),
    });
  }

  try {
    resolveCatalogSql('not_a_real_op', {});
    results.push({ test: 'deny_unknown_catalog_op', pass: false });
  } catch (e) {
    results.push({
      test: 'deny_unknown_catalog_op',
      pass: /unknown catalog/i.test(String(e.message || e)),
    });
  }

  results.push({
    test: 'catalog_ops_registered',
    pass: listCatalogOperations().length >= 5,
    count: listCatalogOperations().length,
  });

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
      return invokeCatalog('catalog_rls_flags', { schema: 'public', table: 'estimates' }, {
        dryRun: true,
      }).then((catOut) => {
        results.push({
          test: 'dry_run_catalog_rls',
          pass:
            catOut.dry_run === true &&
            catOut.path === `/v1/projects/${goodRef}${READ_ONLY_QUERY_PATH_SUFFIX}` &&
            catOut.method === 'POST' &&
            !('sql' in catOut),
        });
        // deny mutation attempt via fake op name
        return invokeCatalog('catalog_rls_flags', {
          schema: 'public',
          table: 'estimates',
          query: 'DELETE FROM public.estimates',
        }, { dryRun: true })
          .then(() => {
            results.push({ test: 'deny_catalog_query_param', pass: false });
          })
          .catch((e) => {
            results.push({
              test: 'deny_catalog_query_param',
              pass: /agent-supplied SQL|DENY/i.test(String(e.message || e)),
            });
          })
          .then(() => {
            const failed = results.filter((r) => !r.pass);
            return { ok: failed.length === 0, results, failed };
          });
      });
    });
  });
}

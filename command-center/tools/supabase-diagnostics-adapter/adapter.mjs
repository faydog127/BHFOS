/**
 * Supabase Diagnostics Adapter — G2.3B-B2C
 *
 * Bounded read facade for Production Diagnostics. Hard endpoint allowlist.
 * Internal credential (when authorized later) stays in process env and is never
 * returned to the Cursor agent.
 *
 * G2.3B-B2C: NO live credential. Default mode is dry-run / deny-proof.
 *
 * Usage:
 *   node tools/supabase-diagnostics-adapter/cli.mjs --help
 *   node tools/supabase-diagnostics-adapter/cli.mjs --self-test
 *   node tools/supabase-diagnostics-adapter/cli.mjs project-status --ref=<ref>   # requires auth later
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const allowlistPath = path.join(here, 'allowlist.json');

export function loadAllowlist() {
  return JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
}

/** Build request path; throws if not allowlisted. */
export function resolveAllowedPath(operation, { ref }) {
  const list = loadAllowlist();
  const op = list.operations[operation];
  if (!op) {
    throw new Error(`DENY: unknown operation "${operation}"`);
  }
  if (op.status === 'unavailable' || op.status === 'deferred') {
    throw new Error(`DENY: operation "${operation}" is ${op.status}: ${op.reason || ''}`);
  }
  if (!ref || !/^[a-z0-9]+$/i.test(ref)) {
    throw new Error('DENY: invalid or missing project ref');
  }
  const built = op.pathTemplate.replace('{ref}', ref);
  const exactOk = Object.values(list.operations).some(
    (o) => o.status === 'allowed' && o.pathTemplate.replace('{ref}', ref) === built
  );
  if (!exactOk) {
    throw new Error(`DENY: path not on allowlist: ${built}`);
  }
  return { method: op.method, path: built, operation };
}

/** Paths that must never be requested. */
export function assertNotProhibited(requestPath) {
  const list = loadAllowlist();
  for (const pattern of list.prohibited_path_substrings) {
    if (requestPath.includes(pattern)) {
      throw new Error(`DENY: prohibited path pattern "${pattern}" in ${requestPath}`);
    }
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

/**
 * Perform allowlisted GET. Credential from SUPABASE_DIAGNOSTICS_ADAPTER_TOKEN
 * only — never accepted as a CLI argument.
 */
export async function invokeAllowlisted(operation, { ref, dryRun = false } = {}) {
  const { method, path: apiPath } = resolveAllowedPath(operation, { ref });
  assertNotProhibited(apiPath);

  if (dryRun || process.env.SUPABASE_ADAPTER_DRY_RUN === '1') {
    return {
      dry_run: true,
      operation,
      method,
      path: apiPath,
      note: 'No network call; credential not required in dry-run',
    };
  }

  const token = process.env.SUPABASE_DIAGNOSTICS_ADAPTER_TOKEN;
  if (!token) {
    throw new Error(
      'DENY: SUPABASE_DIAGNOSTICS_ADAPTER_TOKEN not set (credential not issued under G2.3B-B2C)'
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
    body: JSON.parse(maskPayload(typeof body === 'string' ? body : JSON.stringify(body))),
  };
}

export function selfTest() {
  const results = [];
  const ref = 'abcdefghijklmnopqrst'; // synthetic 20-char-like ref shape

  // Allowed ops resolve
  for (const op of ['project_status', 'project_health', 'edge_function_inventory']) {
    try {
      const r = resolveAllowedPath(op, { ref });
      assertNotProhibited(r.path);
      results.push({ test: `allow_${op}`, pass: true, path: r.path });
    } catch (e) {
      results.push({ test: `allow_${op}`, pass: false, error: String(e.message || e) });
    }
  }

  // Migration list unavailable
  try {
    resolveAllowedPath('migration_list', { ref });
    results.push({ test: 'deny_migration_list', pass: false, error: 'expected deny' });
  } catch (e) {
    results.push({
      test: 'deny_migration_list',
      pass: /DENY/.test(String(e.message || e)),
      error: String(e.message || e),
    });
  }

  // Prohibited paths
  const prohibited = [
    '/v1/projects/abcdefghijklmnopqrst/functions/foo/body',
    '/v1/projects/abcdefghijklmnopqrst/secrets',
    '/v1/projects/abcdefghijklmnopqrst/api-keys',
    '/v1/projects/abcdefghijklmnopqrst/database/query',
    '/v1/projects/abcdefghijklmnopqrst/analytics/endpoints/logs?sql=SELECT%201',
  ];
  for (const p of prohibited) {
    try {
      assertNotProhibited(p);
      results.push({ test: `prohibit_${p}`, pass: false, error: 'expected deny' });
    } catch (e) {
      results.push({
        test: `prohibit_path`,
        path: p,
        pass: /DENY/.test(String(e.message || e)),
      });
    }
  }

  // Agent-provided SQL rejected at operation level
  try {
    resolveAllowedPath('custom_log_sql', { ref });
    results.push({ test: 'deny_custom_log_sql', pass: false });
  } catch (e) {
    results.push({
      test: 'deny_custom_log_sql',
      pass: /DENY|unknown/.test(String(e.message || e)),
    });
  }

  // Credential must not appear in dry-run output
  return invokeAllowlisted('project_status', { ref, dryRun: true }).then((out) => {
    const serialized = JSON.stringify(out);
    results.push({
      test: 'dry_run_no_token_echo',
      pass: !/SUPABASE_DIAGNOSTICS_ADAPTER_TOKEN|Bearer\s+\S+/.test(serialized),
    });
    const failed = results.filter((r) => !r.pass);
    return { ok: failed.length === 0, results, failed };
  });
}

#!/usr/bin/env node
/**
 * health-probe.mjs — G2.3A minimum non-destructive health probe.
 *
 * Verifies deploy health signals without any mutation or authentication bypass.
 * Two modes:
 *   --dir=<path>   Offline: inspect a locally built directory (default: dist).
 *   --url=<base>   HTTP: probe a running frontend / preview / deploy.
 *
 * Checks:
 *   - frontend reachability (index.html present / HTTP 200);
 *   - build-info.json reachability + parse + deployed identity (commit SHA);
 *   - application-shell asset reachability (referenced js/css return 200 / exist).
 *
 * Optional Supabase connectivity (--check-supabase --supabase-url=<url>) makes a
 * single unauthenticated reachability request that exposes NO data, performs NO
 * mutation, and is disabled by default.
 *
 * Guarantees: no authentication bypass, no destructive behaviour, explicit
 * timeouts, clear exit codes, machine-readable (--json) and human output.
 *
 * Usage:
 *   node tools/health-probe.mjs --dir=dist
 *   node tools/health-probe.mjs --url=http://localhost:3000
 * Exit code 0 = all required checks passed; non-zero otherwise.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const commandCenterRoot = path.resolve(toolsDir, '..');

function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const body = raw.slice(2);
    const eq = body.indexOf('=');
    if (eq === -1) args[body] = true;
    else args[body.slice(0, eq)] = body.slice(eq + 1);
  }
  return args;
}

function extractAssetRefs(html) {
  const refs = new Set();
  const patterns = [/(?:src|href)\s*=\s*"(\/[^"]+)"/gi, /(?:src|href)\s*=\s*'(\/[^']+)'/gi];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(String(html || '')))) {
      const ref = match[1];
      if (/\.(?:js|css|wasm)$/i.test(ref)) refs.add(ref);
    }
  }
  return [...refs].sort();
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'bhfos-health-probe/1.0', 'Cache-Control': 'no-cache' },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function check(name, ok, detail) {
  return { name, ok: Boolean(ok), detail: detail || '' };
}

async function probeDir(dir) {
  const checks = [];
  const resolvedDir = path.isAbsolute(dir) ? dir : path.join(commandCenterRoot, dir);
  const indexPath = path.join(resolvedDir, 'index.html');

  const hasIndex = fs.existsSync(indexPath);
  checks.push(check('frontend_reachable', hasIndex, hasIndex ? `${dir}/index.html present` : `missing ${dir}/index.html`));

  let deployedSha = null;
  const infoPath = path.join(resolvedDir, 'build-info.json');
  if (fs.existsSync(infoPath)) {
    try {
      const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
      deployedSha = typeof info.commitSha === 'string' ? info.commitSha : null;
      checks.push(check('build_info_reachable', true, 'build-info.json present and parseable'));
      checks.push(check('deployed_identity', Boolean(deployedSha), deployedSha ? `commitSha=${deployedSha}` : 'commitSha missing'));
    } catch (err) {
      checks.push(check('build_info_reachable', false, `build-info.json unparseable: ${err.message}`));
      checks.push(check('deployed_identity', false, 'build-info.json unparseable'));
    }
  } else {
    checks.push(check('build_info_reachable', false, 'build-info.json missing'));
    checks.push(check('deployed_identity', false, 'no build-info.json'));
  }

  if (hasIndex) {
    const html = fs.readFileSync(indexPath, 'utf8');
    const refs = extractAssetRefs(html);
    const missing = refs.filter((ref) => !fs.existsSync(path.join(resolvedDir, ref.replace(/^\//, ''))));
    checks.push(check('app_shell_assets', refs.length > 0 && missing.length === 0,
      refs.length === 0 ? 'no js/css asset refs found in index.html' : `${refs.length - missing.length}/${refs.length} asset(s) present${missing.length ? `; missing: ${missing.join(', ')}` : ''}`));
  } else {
    checks.push(check('app_shell_assets', false, 'no index.html to inspect'));
  }

  return { deployedSha, checks };
}

async function probeUrl(base, timeoutMs) {
  const checks = [];
  const baseUrl = base.endsWith('/') ? base : `${base}/`;
  let indexHtml = '';

  try {
    const res = await fetchWithTimeout(new URL('/', baseUrl).toString(), timeoutMs);
    indexHtml = await res.text();
    checks.push(check('frontend_reachable', res.ok, `GET / -> ${res.status}`));
  } catch (err) {
    checks.push(check('frontend_reachable', false, `GET / failed: ${err.message}`));
  }

  let deployedSha = null;
  try {
    const res = await fetchWithTimeout(new URL('/build-info.json', baseUrl).toString(), timeoutMs);
    if (res.ok) {
      const info = JSON.parse(await res.text());
      deployedSha = typeof info.commitSha === 'string' ? info.commitSha : null;
      checks.push(check('build_info_reachable', true, `GET /build-info.json -> ${res.status}`));
      checks.push(check('deployed_identity', Boolean(deployedSha), deployedSha ? `commitSha=${deployedSha}` : 'commitSha missing'));
    } else {
      checks.push(check('build_info_reachable', false, `GET /build-info.json -> ${res.status}`));
      checks.push(check('deployed_identity', false, 'build-info.json not reachable'));
    }
  } catch (err) {
    checks.push(check('build_info_reachable', false, `GET /build-info.json failed: ${err.message}`));
    checks.push(check('deployed_identity', false, 'build-info.json not reachable'));
  }

  const refs = extractAssetRefs(indexHtml);
  if (refs.length > 0) {
    let okCount = 0;
    const failed = [];
    for (const ref of refs) {
      try {
        const res = await fetchWithTimeout(new URL(ref, baseUrl).toString(), timeoutMs);
        if (res.ok) okCount += 1;
        else failed.push(`${ref}:${res.status}`);
      } catch (err) {
        failed.push(`${ref}:err`);
      }
    }
    checks.push(check('app_shell_assets', failed.length === 0, `${okCount}/${refs.length} asset(s) reachable${failed.length ? `; failed: ${failed.join(', ')}` : ''}`));
  } else {
    checks.push(check('app_shell_assets', false, 'no js/css asset refs found in index.html'));
  }

  return { deployedSha, checks };
}

async function probeSupabase(url, timeoutMs) {
  // Reachability only: an unauthenticated request to the REST root. Exposes no
  // data, performs no mutation, requires no auth bypass. A 401/404 still proves
  // reachability of the endpoint.
  try {
    const res = await fetchWithTimeout(new URL('/rest/v1/', url.endsWith('/') ? url : `${url}/`).toString(), timeoutMs);
    return check('supabase_reachable', res.status > 0, `GET /rest/v1/ -> ${res.status} (no auth, no data)`);
  } catch (err) {
    return check('supabase_reachable', false, `supabase reachability failed: ${err.message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const timeoutMs = Number.parseInt(args.timeout, 10) > 0 ? Number.parseInt(args.timeout, 10) : 10000;

  let mode;
  let result;
  if (typeof args.url === 'string') {
    mode = 'url';
    result = await probeUrl(args.url, timeoutMs);
  } else {
    mode = 'dir';
    result = await probeDir(typeof args.dir === 'string' ? args.dir : 'dist');
  }

  const checks = [...result.checks];
  if (args['check-supabase']) {
    if (typeof args['supabase-url'] === 'string' && args['supabase-url'].trim()) {
      checks.push(await probeSupabase(args['supabase-url'].trim(), timeoutMs));
    } else {
      checks.push(check('supabase_reachable', false, 'supabase check requested but --supabase-url not provided (skipped)'));
    }
  }

  const requiredChecks = checks.filter((c) => c.name !== 'supabase_reachable');
  const ok = requiredChecks.every((c) => c.ok);

  const report = {
    tool: 'health-probe',
    mode,
    target: mode === 'url' ? args.url : (typeof args.dir === 'string' ? args.dir : 'dist'),
    deployedSha: result.deployedSha,
    ok,
    checks,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[health-probe] mode=${report.mode} target=${report.target}`);
    for (const c of checks) console.log(`  [${c.ok ? 'PASS' : 'FAIL'}] ${c.name}: ${c.detail}`);
    console.log(`[health-probe] deployedSha=${report.deployedSha || '(none)'}`);
    console.log(ok ? '[health-probe] RESULT: HEALTHY' : '[health-probe] RESULT: UNHEALTHY');
  }

  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(`[health-probe] ERROR: ${err && err.message ? err.message : err}`);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * FOUNDER_RUN_READINESS gate — machine-verifiable checks for Founder execution.
 * Never prints secret values. Ends with FOUNDER_RUN_READY or FOUNDER_RUN_BLOCKED.
 */

import childProcess from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');

const CREDENTIAL_BASENAME_DENY = [
  /^\.env(\.|$)/i,
  /secret/i,
  /credential/i,
  /token/i,
  /\.pem$/i,
  /\.p12$/i,
  /\.key$/i,
];

export function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value.trim());
}

export function git(repoRoot, args) {
  return childProcess
    .execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .trim();
}

export function portAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

export function secretNamesPresent(envFilePath, names) {
  if (!fs.existsSync(envFilePath)) {
    return { ok: false, missing: names.slice(), present: [] };
  }
  const text = fs.readFileSync(envFilePath, 'utf8');
  const present = [];
  const missing = [];
  for (const name of names) {
    const re = new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*\\S`, 'm');
    if (re.test(text)) present.push(name);
    else missing.push(name);
  }
  return { ok: missing.length === 0, missing, present };
}

export function credentialFilesInsideRepo(repoRoot) {
  const hits = [];
  const walk = (dir, depth = 0) => {
    if (depth > 4) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist') continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (CREDENTIAL_BASENAME_DENY.some((re) => re.test(ent.name))) {
        // Allow documented templates / examples that are not live secret stores.
        if (/\.example(\.|$)/i.test(ent.name) || /\.template(\.|$)/i.test(ent.name)) continue;
        if (ent.name === '.env.example') continue;
        hits.push(path.relative(repoRoot, full).replaceAll('\\', '/'));
      }
    }
  };
  walk(repoRoot);
  return hits;
}

export function pathIsOutsideRepo(candidate, repoRoot) {
  const abs = path.resolve(candidate);
  const root = path.resolve(repoRoot);
  const rel = path.relative(root, abs);
  return rel.startsWith('..') || path.isAbsolute(rel);
}

/**
 * Evaluate a readiness packet. Returns { verdict, checks[], technical_result, governance_status, authorized_next_state }.
 */
export async function evaluateReadiness(packet, options = {}) {
  const repoRoot = options.repoRoot || DEFAULT_REPO_ROOT;
  const checks = [];
  const add = (id, ok, detail) => {
    checks.push({ id, ok: Boolean(ok), detail: detail ? String(detail).slice(0, 240) : undefined });
  };

  // 1
  add('task_and_authorization_boundary', nonEmpty(packet.task_and_authorization_boundary), 'must be non-empty');

  // 2
  let remote = '';
  try {
    remote = git(repoRoot, ['remote', 'get-url', 'origin']);
  } catch (e) {
    remote = '';
  }
  const expectedRepo = packet.exact_repository;
  add(
    'exact_repository',
    nonEmpty(expectedRepo) && (remote === expectedRepo || remote.replace(/\.git$/, '') === String(expectedRepo).replace(/\.git$/, '')),
    `origin=${remote || 'unavailable'} expected=${expectedRepo || 'missing'}`
  );

  // 3
  const worktree = packet.exact_worktree_path;
  const worktreeOk =
    nonEmpty(worktree) &&
    fs.existsSync(worktree) &&
    path.resolve(worktree) === path.resolve(repoRoot);
  add('exact_worktree_path', worktreeOk, worktree || 'missing');

  // 4
  let head = '';
  try {
    head = git(repoRoot, ['rev-parse', 'HEAD']);
  } catch {
    head = '';
  }
  add(
    'exact_commit_sha',
    isSha(packet.exact_commit_sha) && head.toLowerCase() === String(packet.exact_commit_sha).toLowerCase(),
    `head=${head || 'unavailable'} packet=${packet.exact_commit_sha || 'missing'}`
  );

  // 5
  let porcelain = 'dirty-unknown';
  try {
    porcelain = git(repoRoot, ['status', '--porcelain']);
  } catch {
    porcelain = 'dirty-unknown';
  }
  if (packet.fixture_ignore_worktree_dirtiness === true && options.allowFixtureSkip) {
    add('worktree_cleanliness', true, 'fixture ignore dirtiness');
  } else {
    add('worktree_cleanliness', porcelain === '', porcelain === '' ? 'clean' : 'dirty');
  }

  // 6
  const launcher = packet.protected_launcher_or_script_path;
  const launcherAbs = launcher ? path.resolve(repoRoot, launcher) : '';
  add('protected_launcher_or_script_path', Boolean(launcher) && fs.existsSync(launcherAbs), launcher || 'missing');

  // 7
  if (packet.launcher_sha_pin === undefined || packet.launcher_sha_pin === null || packet.launcher_sha_pin === '') {
    add('launcher_sha_pin_matches', true, 'no pin provided; skipped');
  } else {
    add(
      'launcher_sha_pin_matches',
      isSha(packet.launcher_sha_pin) &&
        isSha(packet.exact_commit_sha) &&
        String(packet.launcher_sha_pin).toLowerCase() === String(packet.exact_commit_sha).toLowerCase(),
      'pin must equal exact_commit_sha'
    );
  }

  // 8
  const requiredFiles = Array.isArray(packet.required_files) ? packet.required_files : [];
  const missingFiles = requiredFiles.filter((f) => !fs.existsSync(path.resolve(repoRoot, f)));
  add('required_files_exist', requiredFiles.length > 0 && missingFiles.length === 0, missingFiles.join(',') || 'ok');

  // 9–10
  const secretStore = packet.external_secret_store_path;
  const secretNames = Array.isArray(packet.required_secret_names) ? packet.required_secret_names : [];
  if (!secretStore && secretNames.length === 0) {
    add('external_secret_store_path', true, 'not required for this packet');
    add('required_secret_names_present', true, 'not required for this packet');
  } else {
    const storeExists = nonEmpty(secretStore) && fs.existsSync(secretStore);
    const outside = storeExists && pathIsOutsideRepo(secretStore, repoRoot);
    add('external_secret_store_path', storeExists && outside, storeExists ? (outside ? 'outside repo' : 'inside repo') : 'missing');
    const names = secretNamesPresent(secretStore || '', secretNames);
    add(
      'required_secret_names_present',
      names.ok,
      names.missing.length ? `missing_names=${names.missing.join(',')}` : `present_count=${names.present.length}`
    );
  }

  // 11
  const credHits = credentialFilesInsideRepo(repoRoot);
  // For live packets, also honor an explicit attestation override used in fixtures.
  if (packet.allow_credential_scan_skip === true && options.allowFixtureSkip) {
    add('no_credential_file_in_repo', true, 'fixture skip');
  } else {
    add('no_credential_file_in_repo', credHits.length === 0, credHits.slice(0, 5).join(',') || 'none');
  }

  // 12
  const expectedRedirect = packet.callback_or_redirect_expected;
  const actualRedirect = packet.callback_or_redirect_actual;
  if (!expectedRedirect && !actualRedirect) {
    add('callback_or_redirect_match', true, 'not required for this packet');
  } else {
    add(
      'callback_or_redirect_match',
      nonEmpty(expectedRedirect) && expectedRedirect === actualRedirect,
      'expected must equal actual'
    );
  }

  // 13
  if (packet.required_local_port === undefined || packet.required_local_port === null || packet.required_local_port === '') {
    add('required_local_port_available', true, 'not required for this packet');
  } else {
    const available = await portAvailable(Number(packet.required_local_port));
    add('required_local_port_available', available, `port=${packet.required_local_port}`);
  }

  // 14
  const deps = Array.isArray(packet.required_dependencies) ? packet.required_dependencies : [];
  if (deps.length === 0) {
    add('required_dependencies_detected', true, 'not required for this packet');
  } else {
    const missingDeps = deps.filter((d) => {
      if (d.kind === 'file') return !fs.existsSync(d.path);
      return true;
    });
    add('required_dependencies_detected', missingDeps.length === 0, missingDeps.length ? 'missing dependency' : 'ok');
  }

  // 15–16
  add('platform_acceptance_tests_passed', packet.platform_acceptance_tests_passed === true, 'must be true');
  add('unit_integration_tests_passed', packet.unit_integration_tests_passed === true, 'must be true');

  // 17
  const ag = packet.architecture_guard_approval || {};
  add(
    'architecture_guard_execution_design',
    ag.applies_to_execution_design === true &&
      isSha(ag.head_sha) &&
      isSha(packet.exact_commit_sha) &&
      String(ag.head_sha).toLowerCase() === String(packet.exact_commit_sha).toLowerCase() &&
      nonEmpty(ag.verdict),
    'AG must apply to exact execution design SHA'
  );

  // 18–20
  add('expected_safe_output', nonEmpty(packet.expected_safe_output), 'must be non-empty');
  const stops = Array.isArray(packet.explicit_stop_conditions) ? packet.explicit_stop_conditions : [];
  add('explicit_stop_conditions', stops.length > 0 && stops.every((s) => nonEmpty(s)), 'need at least one');
  add('one_exact_founder_command_or_action', nonEmpty(packet.one_exact_founder_command_or_action), 'exactly one action string');

  const failed = checks.filter((c) => !c.ok);
  const ready = failed.length === 0;
  const verdict = ready ? 'FOUNDER_RUN_READY' : 'FOUNDER_RUN_BLOCKED';

  return {
    verdict,
    checks,
    failed: failed.map((c) => c.id),
    technical_result: ready
      ? 'All FOUNDER_RUN_READINESS machine and declarative checks passed.'
      : `Readiness blocked on: ${failed.map((c) => c.id).join(', ')}`,
    governance_status: ready
      ? 'Founder execution command may be issued for the single recorded action.'
      : 'Founder execution is not authorized. Route correction; do not send the Founder the command.',
    authorized_next_state: ready
      ? `Issue exactly one Founder action: ${packet.one_exact_founder_command_or_action}`
      : 'Orchestrator classifies failure and routes to Builder/Architecture Guard/Diagnostics without Founder diagnosis.',
  };
}

export function formatReport(result) {
  const lines = [
    'TECHNICAL RESULT:',
    result.technical_result,
    '',
    'GOVERNANCE STATUS:',
    result.governance_status,
    '',
    'AUTHORIZED NEXT STATE:',
    result.authorized_next_state,
    '',
    result.verdict,
  ];
  return lines.join('\n');
}

async function main(argv) {
  if (argv.includes('--self-test')) {
    const { runSelfTests } = await import('./founder-run-readiness.self-test.mjs');
    const { ok, results } = await runSelfTests();
    for (const r of results) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.test}${r.detail ? ` — ${r.detail}` : ''}`);
    }
    process.exit(ok ? 0 : 1);
  }

  const packetIdx = argv.indexOf('--packet');
  if (packetIdx === -1 || !argv[packetIdx + 1]) {
    console.error('Usage: node tools/founder-run-readiness.mjs --packet <file.json> | --self-test');
    process.exit(2);
  }
  const packetPath = path.resolve(argv[packetIdx + 1]);
  const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
  const repoRootIdx = argv.indexOf('--repo-root');
  const repoRoot = repoRootIdx !== -1 ? path.resolve(argv[repoRootIdx + 1]) : DEFAULT_REPO_ROOT;
  const result = await evaluateReadiness(packet, { repoRoot });
  console.log(formatReport(result));
  process.exit(result.verdict === 'FOUNDER_RUN_READY' ? 0 : 1);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

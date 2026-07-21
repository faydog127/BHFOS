/**
 * Self-tests for protected OAuth launcher preflight — fixtures only, no live tunnel/OAuth.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PUBLIC_REDIRECT_URI,
  LOCAL_LISTENER_URI,
  SECRET_NAMES,
  PRODUCTION_PROJECT_REF,
} from './oauth-helper.mjs';
import { TUNNEL_SECRET_NAMES } from './oauth-tunnel.mjs';
import {
  assertPublicHttpsRedirectContract,
  assertNoQuarantinedTokenReuse,
  runLauncherPreflight,
  formatPreflightStatus,
  LauncherPreflightError,
  isSha,
} from './oauth-launcher-preflight.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');

function pass(results, test, ok, detail) {
  results.push({ test, pass: Boolean(ok), ...(detail ? { detail: String(detail).slice(0, 120) } : {}) });
}

export async function runLauncherPreflightSelfTests() {
  const results = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bhfos-preflight-'));
  const secretFile = path.join(tmp, 'diagnostics.env');
  const credsOutside = path.join(tmp, 'tunnel-credentials.json');
  const fakeBin = path.join(tmp, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  fs.writeFileSync(
    secretFile,
    [
      `${SECRET_NAMES.clientId}="synthetic-client-id"`,
      `${SECRET_NAMES.projectRef}="${PRODUCTION_PROJECT_REF}"`,
    ].join('\n') + '\n',
    'utf8'
  );
  fs.writeFileSync(credsOutside, '{"TunnelID":"synthetic","AccountTag":"synthetic"}\n', 'utf8');
  fs.writeFileSync(fakeBin, '', 'utf8');

  const headSha = 'a'.repeat(40);

  // --- HTTPS required / HTTP rejected ---
  pass(
    results,
    'https_public_redirect_required',
    assertPublicHttpsRedirectContract(PUBLIC_REDIRECT_URI) === true &&
      PUBLIC_REDIRECT_URI.startsWith('https://')
  );
  try {
    assertPublicHttpsRedirectContract('http://oauth-diagnostics.bhfos.com/oauth/callback');
    pass(results, 'http_public_redirect_rejected', false);
  } catch (e) {
    pass(
      results,
      'http_public_redirect_rejected',
      e instanceof LauncherPreflightError && e.code === 'HTTP_PUBLIC_REDIRECT'
    );
  }
  try {
    assertPublicHttpsRedirectContract('https://random-abc.trycloudflare.com/oauth/callback');
    pass(results, 'random_hostname_rejected', false);
  } catch (e) {
    pass(
      results,
      'random_hostname_rejected',
      e.code === 'RANDOM_TUNNEL_HOSTNAME' || e.code === 'PUBLIC_REDIRECT_MISMATCH'
    );
  }
  pass(
    results,
    'public_and_local_remain_distinct',
    PUBLIC_REDIRECT_URI !== LOCAL_LISTENER_URI &&
      LOCAL_LISTENER_URI === 'http://127.0.0.1:8765/oauth/callback'
  );

  // --- quarantined tokens ---
  try {
    assertNoQuarantinedTokenReuse({
      I2_SUPABASE_OAUTH_TOKEN_QUARANTINED: '1',
      I2_SUPABASE_OAUTH_ACCESS_TOKEN: 'tok_should_never_be_logged',
    });
    pass(results, 'quarantined_tokens_never_reused', false);
  } catch (e) {
    pass(
      results,
      'quarantined_tokens_never_reused',
      e.code === 'QUARANTINED_TOKEN_REUSE' &&
        !String(e.message).includes('tok_should_never_be_logged')
    );
  }
  pass(
    results,
    'non_quarantined_marker_ok',
    assertNoQuarantinedTokenReuse({}) === true
  );

  // --- start blocked unless readiness ---
  try {
    await runLauncherPreflight({
      repoRoot,
      readinessGate: false,
      env: {
        I2_OAUTH_EXPECTED_SHA: headSha,
        [SECRET_NAMES.secretEnvFile]: secretFile,
        [TUNNEL_SECRET_NAMES.credentialsFile]: credsOutside,
        [TUNNEL_SECRET_NAMES.tunnelId]: 'synthetic',
        [TUNNEL_SECRET_NAMES.cloudflaredExecutable]: fakeBin,
      },
      existsSyncFn: (p) => p === secretFile || p === credsOutside || p === fakeBin,
      gitFn: () => headSha,
      portAvailableFn: async () => true,
    });
    pass(results, 'start_blocked_unless_readiness', false);
  } catch (e) {
    pass(results, 'start_blocked_unless_readiness', e.code === 'READINESS_GATE');
  }

  // --- SHA mismatch ---
  try {
    await runLauncherPreflight({
      repoRoot,
      readinessGate: 'FOUNDER_RUN_READY',
      env: {
        I2_OAUTH_EXPECTED_SHA: 'b'.repeat(40),
        [SECRET_NAMES.secretEnvFile]: secretFile,
        [TUNNEL_SECRET_NAMES.credentialsFile]: credsOutside,
        [TUNNEL_SECRET_NAMES.tunnelId]: 'synthetic',
        [TUNNEL_SECRET_NAMES.cloudflaredExecutable]: fakeBin,
      },
      existsSyncFn: (p) => p === secretFile || p === credsOutside || p === fakeBin,
      gitFn: (_root, args) => {
        if (args[0] === 'rev-parse') return headSha;
        if (args[0] === 'status') return '';
        return '';
      },
      portAvailableFn: async () => true,
    });
    pass(results, 'exact_sha_mismatch_blocked', false);
  } catch (e) {
    pass(results, 'exact_sha_mismatch_blocked', e.code === 'SHA_MISMATCH');
  }

  // --- dirty worktree ---
  try {
    await runLauncherPreflight({
      repoRoot,
      readinessGate: 'FOUNDER_RUN_READY',
      env: {
        I2_OAUTH_EXPECTED_SHA: headSha,
        [SECRET_NAMES.secretEnvFile]: secretFile,
        [TUNNEL_SECRET_NAMES.credentialsFile]: credsOutside,
        [TUNNEL_SECRET_NAMES.tunnelId]: 'synthetic',
        [TUNNEL_SECRET_NAMES.cloudflaredExecutable]: fakeBin,
      },
      existsSyncFn: (p) => p === secretFile || p === credsOutside || p === fakeBin,
      gitFn: (_root, args) => {
        if (args[0] === 'rev-parse') return headSha;
        if (args[0] === 'status') return ' M dirty.txt';
        return '';
      },
      portAvailableFn: async () => true,
    });
    pass(results, 'dirty_worktree_blocked', false);
  } catch (e) {
    pass(results, 'dirty_worktree_blocked', e.code === 'DIRTY_WORKTREE');
  }

  // --- credentials inside repo blocked ---
  const insideCreds = path.join(repoRoot, 'MUST-NOT-EXIST-tunnel-creds.json');
  try {
    await runLauncherPreflight({
      repoRoot,
      readinessGate: 'FOUNDER_RUN_READY',
      env: {
        I2_OAUTH_EXPECTED_SHA: headSha,
        [SECRET_NAMES.secretEnvFile]: secretFile,
        [TUNNEL_SECRET_NAMES.credentialsFile]: insideCreds,
        [TUNNEL_SECRET_NAMES.tunnelId]: 'synthetic',
        [TUNNEL_SECRET_NAMES.cloudflaredExecutable]: fakeBin,
      },
      existsSyncFn: (p) => p === secretFile || p === insideCreds || p === fakeBin,
      gitFn: (_root, args) => {
        if (args[0] === 'rev-parse') return headSha;
        if (args[0] === 'status') return '';
        return '';
      },
      portAvailableFn: async () => true,
    });
    pass(results, 'tunnel_credentials_inside_repo_block', false);
  } catch (e) {
    pass(
      results,
      'tunnel_credentials_inside_repo_block',
      e.code === 'TUNNEL_CREDS_IN_REPO'
    );
  }

  // --- happy path (mocked git/port/fs) ---
  const happy = await runLauncherPreflight({
    repoRoot,
    readinessGate: 'FOUNDER_RUN_READY',
    env: {
      I2_OAUTH_EXPECTED_SHA: headSha,
      [SECRET_NAMES.secretEnvFile]: secretFile,
      [TUNNEL_SECRET_NAMES.credentialsFile]: credsOutside,
      [TUNNEL_SECRET_NAMES.tunnelId]: 'synthetic',
      [TUNNEL_SECRET_NAMES.cloudflaredExecutable]: fakeBin,
    },
    existsSyncFn: (p) => p === secretFile || p === credsOutside || p === fakeBin,
    gitFn: (_root, args) => {
      if (args[0] === 'rev-parse') return headSha;
      if (args[0] === 'status') return '';
      return '';
    },
    portAvailableFn: async () => true,
  });
  pass(
    results,
    'preflight_happy_path',
    happy.ok &&
      happy.phases.exact_sha &&
      happy.phases.clean_worktree &&
      happy.phases.external_secret_store &&
      happy.phases.tunnel_executable &&
      happy.phases.tunnel_config &&
      happy.phases.tunnel_credentials &&
      happy.phases.local_port &&
      happy.phases.readiness_gate
  );

  const status = formatPreflightStatus(happy.phases);
  pass(
    results,
    'preflight_status_no_secrets',
    !status.includes('synthetic-client-id') &&
      !status.includes('AccountTag') &&
      status.includes('token values: not displayed') &&
      status.includes(PUBLIC_REDIRECT_URI) &&
      isSha(headSha)
  );

  // --- local bind remains loopback ---
  pass(
    results,
    'local_bind_loopback_only',
    LOCAL_LISTENER_URI.startsWith('http://127.0.0.1:') &&
      !LOCAL_LISTENER_URI.includes('0.0.0.0')
  );

  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  const failed = results.filter((r) => !r.pass);
  return { ok: failed.length === 0, results, failed };
}

const isDirect =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  runLauncherPreflightSelfTests().then((r) => {
    console.log(JSON.stringify({ ok: r.ok, failed: r.failed.map((f) => f.test) }, null, 2));
    process.exit(r.ok ? 0 : 1);
  });
}

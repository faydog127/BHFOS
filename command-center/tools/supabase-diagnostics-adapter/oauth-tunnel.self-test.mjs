/**
 * Self-tests for Cloudflare Named Tunnel OAuth wrapper — mocks only, no live Cloudflare.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PUBLIC_REDIRECT_URI,
  LOCAL_LISTENER_URI,
  CALLBACK_PATH,
} from './oauth-helper.mjs';
import {
  TUNNEL_CLASS,
  TUNNEL_STABLE_HOSTNAME,
  TUNNEL_FORWARD_PATH,
  TUNNEL_SECRET_NAMES,
  buildNamedTunnelIngressConfig,
  assertPathOnlyForwardContract,
  assertCredentialsOutsideRepo,
  serializeTunnelConfigYaml,
  formatTunnelStatus,
  createTunnelController,
  OAuthTunnelError,
} from './oauth-tunnel.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

function pass(results, test, ok, detail) {
  results.push({ test, pass: Boolean(ok), ...(detail ? { detail: String(detail).slice(0, 120) } : {}) });
}

export async function runTunnelSelfTests() {
  const results = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bhfos-tunnel-'));
  const credsOutside = path.join(tmp, 'tunnel-credentials.json');
  fs.writeFileSync(credsOutside, '{"AccountTag":"synthetic","TunnelID":"synthetic-id"}\n', 'utf8');
  const fakeBin = path.join(tmp, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  fs.writeFileSync(fakeBin, '', 'utf8');

  // --- public vs local contract ---
  pass(
    results,
    'public_https_redirect_exact',
    PUBLIC_REDIRECT_URI === 'https://oauth-diagnostics.bhfos.com/oauth/callback'
  );
  pass(
    results,
    'local_http_listener_exact',
    LOCAL_LISTENER_URI === 'http://127.0.0.1:8765/oauth/callback'
  );
  pass(
    results,
    'stable_hostname_pinned',
    TUNNEL_STABLE_HOSTNAME === 'oauth-diagnostics.bhfos.com' && TUNNEL_CLASS === 'cloudflare_named'
  );
  pass(results, 'forward_path_only_oauth_callback', TUNNEL_FORWARD_PATH === '/oauth/callback');

  // --- path-only config ---
  const good = buildNamedTunnelIngressConfig({
    tunnelId: 'synthetic-tunnel-id',
    credentialsFile: credsOutside,
  });
  pass(results, 'path_only_contract_ok', assertPathOnlyForwardContract(good) === true);
  pass(
    results,
    'host_rewrite_to_loopback',
    good.ingress[0].originRequest.httpHostHeader === '127.0.0.1:8765'
  );
  pass(results, 'catch_all_deny_present', good.ingress[1].service === 'http_status:404');

  try {
    buildNamedTunnelIngressConfig({
      tunnelId: 'x',
      credentialsFile: credsOutside,
      hostname: 'random-abc.trycloudflare.com',
    });
    pass(results, 'random_hostname_rejected', false);
  } catch (e) {
    pass(results, 'random_hostname_rejected', e instanceof OAuthTunnelError && e.code === 'TUNNEL_HOSTNAME');
  }

  try {
    buildNamedTunnelIngressConfig({
      tunnelId: 'x',
      credentialsFile: credsOutside,
      forwardPath: '/admin',
    });
    pass(results, 'non_callback_path_rejected', false);
  } catch (e) {
    pass(results, 'non_callback_path_rejected', e.code === 'TUNNEL_PATH');
  }

  const multi = {
    tunnel: 'x',
    'credentials-file': credsOutside,
    ingress: [
      {
        hostname: TUNNEL_STABLE_HOSTNAME,
        path: CALLBACK_PATH,
        service: 'http://127.0.0.1:8765',
        originRequest: { httpHostHeader: '127.0.0.1:8765' },
      },
      {
        hostname: TUNNEL_STABLE_HOSTNAME,
        path: '/',
        service: 'http://127.0.0.1:8765',
      },
      { service: 'http_status:404' },
    ],
  };
  try {
    assertPathOnlyForwardContract(multi);
    pass(results, 'extra_forward_paths_rejected', false);
  } catch (e) {
    pass(results, 'extra_forward_paths_rejected', e.code === 'TUNNEL_INGRESS_EXTRA');
  }

  // --- credentials outside repo ---
  pass(
    results,
    'credentials_outside_repo_ok',
    assertCredentialsOutsideRepo(credsOutside, repoRoot) === path.resolve(credsOutside)
  );
  const insideCreds = path.join(repoRoot, 'tunnel-credentials-MUST-NOT-EXIST.json');
  try {
    assertCredentialsOutsideRepo(insideCreds, repoRoot);
    pass(results, 'credentials_inside_repo_rejected', false);
  } catch (e) {
    pass(results, 'credentials_inside_repo_rejected', e.code === 'TUNNEL_CREDS_IN_REPO');
  }

  // --- missing creds fail closed ---
  try {
    const ctrl = createTunnelController({
      env: {
        [TUNNEL_SECRET_NAMES.tunnelId]: 'synthetic',
        // credentials missing
        [TUNNEL_SECRET_NAMES.cloudflaredExecutable]: fakeBin,
      },
      repoRoot,
      readinessGate: 'FOUNDER_RUN_READY',
      existsSyncFn: (p) => p === fakeBin,
    });
    ctrl.assertReadyToStart();
    pass(results, 'missing_creds_fail_closed', false);
  } catch (e) {
    pass(
      results,
      'missing_creds_fail_closed',
      e instanceof OAuthTunnelError && e.code === 'TUNNEL_CREDS_MISSING'
    );
  }

  // --- readiness gate ---
  try {
    const ctrl = createTunnelController({
      env: {
        [TUNNEL_SECRET_NAMES.credentialsFile]: credsOutside,
        [TUNNEL_SECRET_NAMES.tunnelId]: 'synthetic',
        [TUNNEL_SECRET_NAMES.cloudflaredExecutable]: fakeBin,
      },
      repoRoot,
      readinessGate: false,
      existsSyncFn: (p) => p === fakeBin || p === credsOutside,
    });
    await ctrl.start();
    pass(results, 'start_before_ready_denied', false);
  } catch (e) {
    pass(results, 'start_before_ready_denied', e.code === 'TUNNEL_READINESS_GATE');
  }

  // --- lifecycle with mocks: start → health → stop → closure ---
  let spawned = false;
  let killed = false;
  let fetchCalls = 0;
  const ctrl = createTunnelController({
    env: {
      [TUNNEL_SECRET_NAMES.credentialsFile]: credsOutside,
      [TUNNEL_SECRET_NAMES.tunnelId]: 'synthetic',
      [TUNNEL_SECRET_NAMES.cloudflaredExecutable]: fakeBin,
    },
    repoRoot,
    readinessGate: 'FOUNDER_RUN_READY',
    existsSyncFn: (p) => p === fakeBin || p === credsOutside || fs.existsSync(p),
    spawnFn: () => {
      spawned = true;
      return { killed: false, kill() { killed = true; this.killed = true; } };
    },
    killFn: (child) => {
      killed = true;
      child.killed = true;
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      // First calls while "up": helper-like 400; after stop: throw (closed)
      if (!killed) return { status: 400 };
      throw new Error('ECONNREFUSED');
    },
    sleepFn: async () => {},
    healthTimeoutMs: 2000,
    closureTimeoutMs: 2000,
    configDir: tmp,
  });

  let bodyRan = false;
  await ctrl.runWithTunnel(async () => {
    bodyRan = true;
    return 'ok';
  });
  const state = ctrl.getState();
  pass(
    results,
    'lifecycle_stop_after_run',
    spawned && killed && bodyRan && state.stopped && state.healthOk && state.publicClosed
  );

  // --- stop after failure ---
  let killedOnFail = false;
  const failCtrl = createTunnelController({
    env: {
      [TUNNEL_SECRET_NAMES.credentialsFile]: credsOutside,
      [TUNNEL_SECRET_NAMES.tunnelId]: 'synthetic',
      [TUNNEL_SECRET_NAMES.cloudflaredExecutable]: fakeBin,
    },
    repoRoot,
    readinessGate: 'FOUNDER_RUN_READY',
    existsSyncFn: (p) => p === fakeBin || p === credsOutside || fs.existsSync(p),
    spawnFn: () => ({
      killed: false,
      kill() {
        killedOnFail = true;
        this.killed = true;
      },
    }),
    fetchImpl: async () => {
      if (!killedOnFail) return { status: 400 };
      throw new Error('ECONNREFUSED');
    },
    sleepFn: async () => {},
    configDir: tmp,
  });
  try {
    await failCtrl.runWithTunnel(async () => {
      throw new Error('synthetic authorize failure');
    });
    pass(results, 'stop_after_failure', false);
  } catch (e) {
    const st = failCtrl.getState();
    pass(
      results,
      'stop_after_failure',
      /synthetic authorize failure/.test(String(e.message)) && st.stopped && st.publicClosed
    );
  }

  // --- status has no secret-shaped material ---
  const yaml = serializeTunnelConfigYaml(good);
  const status = formatTunnelStatus({
    phase: 'test',
    started: true,
    stopped: true,
    healthOk: true,
    publicClosed: true,
  });
  const combined = status + yaml + JSON.stringify(results);
  pass(
    results,
    'no_secret_shaped_status',
    !/AccountTag|TunnelSecret|access_token|refresh_token|code_verifier|Bearer\s+\S{20,}/i.test(
      combined
    ) &&
      status.includes('token values') === false &&
      status.includes(PUBLIC_REDIRECT_URI) &&
      status.includes(LOCAL_LISTENER_URI)
  );

  // --- closure verify fails if still reachable ---
  const stuckCtrl = createTunnelController({
    env: {
      [TUNNEL_SECRET_NAMES.credentialsFile]: credsOutside,
      [TUNNEL_SECRET_NAMES.tunnelId]: 'synthetic',
      [TUNNEL_SECRET_NAMES.cloudflaredExecutable]: fakeBin,
    },
    repoRoot,
    readinessGate: 'FOUNDER_RUN_READY',
    existsSyncFn: (p) => p === fakeBin || p === credsOutside || fs.existsSync(p),
    spawnFn: () => ({ killed: false, kill() { this.killed = true; } }),
    fetchImpl: async () => ({ status: 400 }), // never closes
    sleepFn: async () => {},
    healthTimeoutMs: 100,
    closureTimeoutMs: 100,
    configDir: tmp,
  });
  try {
    await stuckCtrl.runWithTunnel(async () => 'ok');
    pass(results, 'closure_failure_blocks', false);
  } catch (e) {
    pass(results, 'closure_failure_blocks', e.code === 'TUNNEL_CLOSURE_FAILED');
  }

  // --- 502/530 after stop counts as public callback closed ---
  let killed502 = false;
  const closed502Ctrl = createTunnelController({
    env: {
      [TUNNEL_SECRET_NAMES.credentialsFile]: credsOutside,
      [TUNNEL_SECRET_NAMES.tunnelId]: 'synthetic',
      [TUNNEL_SECRET_NAMES.cloudflaredExecutable]: fakeBin,
    },
    repoRoot,
    readinessGate: 'FOUNDER_RUN_READY',
    existsSyncFn: (p) => p === fakeBin || p === credsOutside || fs.existsSync(p),
    spawnFn: () => ({
      killed: false,
      kill() {
        killed502 = true;
        this.killed = true;
      },
    }),
    fetchImpl: async () => {
      if (!killed502) return { status: 400 };
      return { status: 502 };
    },
    sleepFn: async () => {},
    configDir: tmp,
  });
  await closed502Ctrl.runWithTunnel(async () => 'ok');
  pass(
    results,
    'closure_502_treated_as_closed',
    closed502Ctrl.getState().publicClosed === true
  );

  pass(results, 'fetch_probe_used', fetchCalls >= 1);

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
  runTunnelSelfTests().then((r) => {
    console.log(JSON.stringify({ ok: r.ok, failed: r.failed.map((f) => f.test) }, null, 2));
    process.exit(r.ok ? 0 : 1);
  });
}

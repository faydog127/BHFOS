/**
 * Cloudflare Named Tunnel lifecycle for Diagnostics OAuth (G2.3B-B2D Option B).
 *
 * Stable hostname only. Path-only forward of /oauth/callback to the local
 * loopback listener. Credentials stay outside the repository. Never logs
 * codes, state, PKCE verifiers, client secrets, or tokens.
 *
 * Live cloudflared is not required in CI — inject spawn/fetch/process hooks.
 */

import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CALLBACK_HOST,
  CALLBACK_PATH,
  CALLBACK_PORT,
  LOCAL_LISTENER_URI,
  PUBLIC_CALLBACK_HOST,
  PUBLIC_REDIRECT_URI,
  OAuthHelperError,
} from './oauth-helper.mjs';

export const TUNNEL_CLASS = 'cloudflare_named';
export const TUNNEL_STABLE_HOSTNAME = PUBLIC_CALLBACK_HOST;
export const TUNNEL_PUBLIC_CALLBACK_URL = PUBLIC_REDIRECT_URI;
export const TUNNEL_LOCAL_SERVICE = `http://${CALLBACK_HOST}:${CALLBACK_PORT}`;
export const TUNNEL_FORWARD_PATH = CALLBACK_PATH;

export const TUNNEL_SECRET_NAMES = Object.freeze({
  credentialsFile: 'I2_CLOUDFLARE_TUNNEL_CREDENTIALS_FILE',
  tunnelId: 'I2_CLOUDFLARE_TUNNEL_ID',
  cloudflaredExecutable: 'I2_CLOUDFLARED_EXECUTABLE',
});

/** Default Founder-machine credential directory (outside repo). */
export function defaultTunnelCredentialsDir(env = process.env) {
  const localAppData = env.LOCALAPPDATA;
  if (!localAppData) return null;
  return path.join(localAppData, 'BHFOS', 'production-diagnostics', 'tunnel');
}

export class OAuthTunnelError extends Error {
  constructor(message, code = 'OAUTH_TUNNEL_DENY') {
    super(message);
    this.name = 'OAuthTunnelError';
    this.code = code;
  }
}

/**
 * Exact path-only ingress contract (Cloudflare Named Tunnel YAML shape).
 * Catch-all deny is mandatory. Host rewrite preserves local loopback Host check.
 */
export function buildNamedTunnelIngressConfig({
  tunnelId,
  credentialsFile,
  hostname = TUNNEL_STABLE_HOSTNAME,
  forwardPath = TUNNEL_FORWARD_PATH,
  localService = TUNNEL_LOCAL_SERVICE,
} = {}) {
  if (!tunnelId || typeof tunnelId !== 'string' || !tunnelId.trim()) {
    throw new OAuthTunnelError('DENY: named tunnel id missing', 'TUNNEL_ID_MISSING');
  }
  if (!credentialsFile || typeof credentialsFile !== 'string') {
    throw new OAuthTunnelError('DENY: tunnel credentials path missing', 'TUNNEL_CREDS_MISSING');
  }
  if (hostname !== TUNNEL_STABLE_HOSTNAME) {
    throw new OAuthTunnelError(
      'DENY: tunnel hostname must be the pinned stable Diagnostics hostname',
      'TUNNEL_HOSTNAME'
    );
  }
  if (forwardPath !== CALLBACK_PATH) {
    throw new OAuthTunnelError('DENY: tunnel may forward only /oauth/callback', 'TUNNEL_PATH');
  }
  if (localService !== TUNNEL_LOCAL_SERVICE) {
    throw new OAuthTunnelError(
      'DENY: tunnel local service must be http://127.0.0.1:8765',
      'TUNNEL_LOCAL_SERVICE'
    );
  }

  return {
    tunnel: tunnelId.trim(),
    'credentials-file': credentialsFile,
    ingress: [
      {
        hostname,
        path: forwardPath,
        service: localService,
        originRequest: {
          httpHostHeader: `${CALLBACK_HOST}:${CALLBACK_PORT}`,
        },
      },
      {
        service: 'http_status:404',
      },
    ],
  };
}

/** Serialize ingress config to YAML-ish text without a YAML dependency. */
export function serializeTunnelConfigYaml(config) {
  const lines = [];
  lines.push(`tunnel: ${config.tunnel}`);
  lines.push(`credentials-file: ${JSON.stringify(config['credentials-file'])}`);
  lines.push('ingress:');
  for (const rule of config.ingress) {
    if (rule.hostname) {
      lines.push(`  - hostname: ${rule.hostname}`);
      lines.push(`    path: ${rule.path}`);
      lines.push(`    service: ${rule.service}`);
      if (rule.originRequest?.httpHostHeader) {
        lines.push('    originRequest:');
        lines.push(`      httpHostHeader: ${JSON.stringify(rule.originRequest.httpHostHeader)}`);
      }
    } else {
      lines.push(`  - service: ${rule.service}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Fail-closed validation of path-only + catch-all deny + Host rewrite.
 * Rejects multi-path, wildcard, or non-callback forwards.
 */
export function assertPathOnlyForwardContract(config) {
  if (!config || !Array.isArray(config.ingress) || config.ingress.length < 2) {
    throw new OAuthTunnelError('DENY: tunnel ingress must include path rule + catch-all', 'TUNNEL_INGRESS');
  }
  const [callbackRule, ...rest] = config.ingress;
  const catchAll = rest[rest.length - 1];
  if (rest.length !== 1) {
    throw new OAuthTunnelError(
      'DENY: tunnel ingress must have exactly one forward rule plus catch-all deny',
      'TUNNEL_INGRESS_EXTRA'
    );
  }
  if (!callbackRule || callbackRule.path !== CALLBACK_PATH) {
    throw new OAuthTunnelError('DENY: only /oauth/callback may be forwarded', 'TUNNEL_PATH');
  }
  if (callbackRule.hostname !== TUNNEL_STABLE_HOSTNAME) {
    throw new OAuthTunnelError('DENY: unstable or unpinned tunnel hostname', 'TUNNEL_HOSTNAME');
  }
  if (callbackRule.service !== TUNNEL_LOCAL_SERVICE) {
    throw new OAuthTunnelError('DENY: forward target must be local loopback listener', 'TUNNEL_LOCAL_SERVICE');
  }
  if (callbackRule.originRequest?.httpHostHeader !== `${CALLBACK_HOST}:${CALLBACK_PORT}`) {
    throw new OAuthTunnelError(
      'DENY: origin Host rewrite to 127.0.0.1:8765 is required',
      'TUNNEL_HOST_REWRITE'
    );
  }
  if (!catchAll || catchAll.service !== 'http_status:404' || catchAll.hostname || catchAll.path) {
    throw new OAuthTunnelError('DENY: catch-all deny (http_status:404) required', 'TUNNEL_CATCH_ALL');
  }
  return true;
}

export function assertCredentialsOutsideRepo(credentialsFile, repoRoot) {
  if (!credentialsFile) {
    throw new OAuthTunnelError('DENY: tunnel credentials path missing', 'TUNNEL_CREDS_MISSING');
  }
  const abs = path.resolve(credentialsFile);
  const root = path.resolve(repoRoot);
  const rel = path.relative(root, abs);
  const outside = rel.startsWith('..') || path.isAbsolute(rel);
  if (!outside) {
    throw new OAuthTunnelError(
      'DENY: tunnel credentials must not live inside the repository',
      'TUNNEL_CREDS_IN_REPO'
    );
  }
  return abs;
}

export function resolveCloudflaredExecutable(env = process.env, existsSyncFn = fs.existsSync) {
  const fromEnv = env[TUNNEL_SECRET_NAMES.cloudflaredExecutable];
  if (fromEnv) {
    if (!path.isAbsolute(fromEnv)) {
      throw new OAuthTunnelError(
        'DENY: I2_CLOUDFLARED_EXECUTABLE must be an absolute path',
        'TUNNEL_BIN_NOT_ABSOLUTE'
      );
    }
    if (!existsSyncFn(fromEnv)) {
      throw new OAuthTunnelError('DENY: cloudflared executable not found', 'TUNNEL_BIN_MISSING');
    }
    return fromEnv;
  }
  // Common absolute installs only — never PATH search.
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\cloudflared\\cloudflared.exe',
          'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
        ]
      : ['/usr/local/bin/cloudflared', '/usr/bin/cloudflared'];
  for (const c of candidates) {
    if (existsSyncFn(c)) return c;
  }
  throw new OAuthTunnelError(
    'DENY: cloudflared not found at approved absolute paths',
    'TUNNEL_BIN_MISSING'
  );
}

export function loadTunnelEnvConfig(env = process.env) {
  const credentialsFile = env[TUNNEL_SECRET_NAMES.credentialsFile];
  const tunnelId = env[TUNNEL_SECRET_NAMES.tunnelId];
  return { credentialsFile, tunnelId };
}

/**
 * Safe status lines — never include secrets, query strings, or credential paths' contents.
 */
export function formatTunnelStatus({
  phase,
  started = false,
  stopped = false,
  healthOk = false,
  publicClosed = false,
}) {
  return [
    `tunnel class: ${TUNNEL_CLASS}`,
    `tunnel hostname: ${TUNNEL_STABLE_HOSTNAME}`,
    `public redirect: ${PUBLIC_REDIRECT_URI}`,
    `local listener: ${LOCAL_LISTENER_URI}`,
    `forward path: ${TUNNEL_FORWARD_PATH}`,
    `tunnel phase: ${phase}`,
    `tunnel started: ${started ? 'yes' : 'no'}`,
    `tunnel health: ${healthOk ? 'ok' : 'not-ok'}`,
    `tunnel stopped: ${stopped ? 'yes' : 'no'}`,
    `public callback closed: ${publicClosed ? 'yes' : 'no'}`,
  ].join('\n');
}

/**
 * Create a lifecycle controller. Injectables keep CI free of live Cloudflare.
 */
export function createTunnelController(options = {}) {
  const env = options.env || process.env;
  const repoRoot = options.repoRoot || process.cwd();
  const spawnFn = options.spawnFn || childProcess.spawn;
  const existsSyncFn = options.existsSyncFn || fs.existsSync;
  const writeFileSyncFn = options.writeFileSyncFn || fs.writeFileSync;
  const mkdirSyncFn = options.mkdirSyncFn || fs.mkdirSync;
  const unlinkSyncFn = options.unlinkSyncFn || fs.unlinkSync;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sleepFn =
    options.sleepFn || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const healthTimeoutMs = options.healthTimeoutMs ?? 15_000;
  const closureTimeoutMs = options.closureTimeoutMs ?? 15_000;
  const readinessGate = options.readinessGate; // must be true / 'FOUNDER_RUN_READY' before start

  let child = null;
  let configPath = null;
  let started = false;
  let stopped = false;
  let healthOk = false;
  let publicClosed = false;

  function status(phase) {
    return formatTunnelStatus({
      phase,
      started,
      stopped,
      healthOk,
      publicClosed,
    });
  }

  function assertReadyToStart() {
    if (readinessGate !== true && readinessGate !== 'FOUNDER_RUN_READY') {
      throw new OAuthTunnelError(
        'DENY: tunnel must not start before FOUNDER_RUN_READY',
        'TUNNEL_READINESS_GATE'
      );
    }
    const { credentialsFile, tunnelId } = loadTunnelEnvConfig(env);
    if (!credentialsFile) {
      throw new OAuthTunnelError(
        `DENY: missing ${TUNNEL_SECRET_NAMES.credentialsFile}`,
        'TUNNEL_CREDS_MISSING'
      );
    }
    if (!tunnelId) {
      throw new OAuthTunnelError(
        `DENY: missing ${TUNNEL_SECRET_NAMES.tunnelId}`,
        'TUNNEL_ID_MISSING'
      );
    }
    const credsAbs = assertCredentialsOutsideRepo(credentialsFile, repoRoot);
    if (!existsSyncFn(credsAbs)) {
      throw new OAuthTunnelError('DENY: tunnel credentials file not found', 'TUNNEL_CREDS_MISSING');
    }
    const config = buildNamedTunnelIngressConfig({
      tunnelId,
      credentialsFile: credsAbs,
    });
    assertPathOnlyForwardContract(config);
    const bin = resolveCloudflaredExecutable(env, existsSyncFn);
    return { config, credsAbs, bin, tunnelId };
  }

  async function start() {
    if (started && !stopped) {
      throw new OAuthTunnelError('DENY: tunnel already started', 'TUNNEL_ALREADY_UP');
    }
    const { config, bin } = assertReadyToStart();
    const dir = options.configDir || fs.mkdtempSync(path.join(os.tmpdir(), 'bhfos-oauth-tunnel-'));
    mkdirSyncFn(dir, { recursive: true });
    configPath = path.join(dir, 'oauth-tunnel-config.yml');
    writeFileSyncFn(configPath, serializeTunnelConfigYaml(config), { encoding: 'utf8', mode: 0o600 });

    child = spawnFn(bin, ['tunnel', '--config', configPath, 'run'], {
      detached: false,
      stdio: 'ignore',
      shell: false,
      windowsHide: true,
    });
    if (!child) {
      throw new OAuthTunnelError('DENY: failed to spawn cloudflared', 'TUNNEL_SPAWN');
    }
    started = true;
    stopped = false;
    healthOk = false;
    publicClosed = false;
    return { status: status('started'), configPath };
  }

  async function verifyHealth() {
    if (!started || stopped) {
      throw new OAuthTunnelError('DENY: tunnel not running for health check', 'TUNNEL_NOT_RUNNING');
    }
    if (typeof fetchImpl !== 'function') {
      throw new OAuthTunnelError('DENY: fetch unavailable for tunnel health', 'TUNNEL_HEALTH');
    }
    const deadline = Date.now() + healthTimeoutMs;
    let lastErr = 'unreachable';
    while (Date.now() < deadline) {
      try {
        // Probe path only — never attach authorize query params.
        const res = await fetchImpl(TUNNEL_PUBLIC_CALLBACK_URL, {
          method: 'GET',
          redirect: 'manual',
        });
        // Helper may 400 without state; any HTTP response proves path forward.
        if (res && typeof res.status === 'number' && res.status > 0) {
          healthOk = true;
          return { status: status('health_ok'), httpStatus: res.status };
        }
        lastErr = `status=${res && res.status}`;
      } catch (e) {
        lastErr = e && e.code ? e.code : 'fetch_error';
      }
      await sleepFn(250);
    }
    throw new OAuthTunnelError(
      `DENY: tunnel health check failed (${lastErr})`,
      'TUNNEL_HEALTH'
    );
  }

  async function stop() {
    if (!started) {
      stopped = true;
      return { status: status('stop_noop') };
    }
    if (stopped) {
      return { status: status('already_stopped') };
    }
    try {
      if (child && !child.killed) {
        if (typeof options.killFn === 'function') {
          options.killFn(child);
        } else {
          child.kill('SIGTERM');
        }
      }
    } catch {
      /* continue to mark stopped; closure verify is authoritative */
    }
    child = null;
    stopped = true;
    if (configPath) {
      try {
        unlinkSyncFn(configPath);
      } catch {
        /* ignore */
      }
      configPath = null;
    }
    return { status: status('stopped') };
  }

  /**
   * After stop: public callback must no longer serve the helper.
   * Connection failure / timeout / non-forward = closed.
   */
  async function verifyPublicCallbackClosed() {
    if (!stopped) {
      throw new OAuthTunnelError(
        'DENY: cannot verify public callback closure while tunnel not stopped',
        'TUNNEL_STILL_UP'
      );
    }
    if (typeof fetchImpl !== 'function') {
      throw new OAuthTunnelError('DENY: fetch unavailable for closure verify', 'TUNNEL_CLOSURE');
    }
    const deadline = Date.now() + closureTimeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await fetchImpl(TUNNEL_PUBLIC_CALLBACK_URL, {
          method: 'GET',
          redirect: 'manual',
        });
        // Cloudflare edge errors after tunnel stop mean the public callback is closed.
        if (res && (res.status === 502 || res.status === 530)) {
          publicClosed = true;
          return { status: status('public_callback_closed'), closed: true };
        }
        // If still getting helper-like responses after stop, not closed yet.
        if (res && (res.status === 200 || res.status === 400 || res.status === 404)) {
          await sleepFn(250);
          continue;
        }
        // Other statuses: keep polling until timeout (do not claim closed).
        await sleepFn(250);
      } catch {
        publicClosed = true;
        return { status: status('public_callback_closed'), closed: true };
      }
    }
    // Still reachable after stop → surface failure (do not swallow as closed)
    publicClosed = false;
    throw new OAuthTunnelError(
      'DENY: public callback still reachable after tunnel stop',
      'TUNNEL_CLOSURE_FAILED'
    );
  }

  /**
   * Run authorizeBody with guaranteed stop + closure verify afterward.
   */
  async function runWithTunnel(authorizeBody) {
    let bodyError = null;
    let bodyResult = null;
    try {
      await start();
      await verifyHealth();
      bodyResult = await authorizeBody();
    } catch (e) {
      bodyError = e;
    } finally {
      try {
        await stop();
      } catch (stopErr) {
        if (!bodyError) bodyError = stopErr;
      }
      try {
        await verifyPublicCallbackClosed();
      } catch (closeErr) {
        if (!bodyError) bodyError = closeErr;
      }
    }
    if (bodyError) throw bodyError;
    return bodyResult;
  }

  return {
    assertReadyToStart,
    start,
    verifyHealth,
    stop,
    verifyPublicCallbackClosed,
    runWithTunnel,
    status,
    getState: () => ({ started, stopped, healthOk, publicClosed, configPath }),
  };
}

export {
  PUBLIC_REDIRECT_URI,
  LOCAL_LISTENER_URI,
  PUBLIC_CALLBACK_HOST,
  OAuthHelperError,
};

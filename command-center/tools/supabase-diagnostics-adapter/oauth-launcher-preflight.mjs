/**
 * Protected OAuth launcher preflight (G2.3B-B2D Option B).
 *
 * Sequencing before tunnel start / authorize:
 *   exact SHA → clean worktree → external secret store → tunnel assets →
 *   local port → readiness gate
 *
 * Never logs codes, state, PKCE, client secrets, tokens, or credential contents.
 */

import childProcess from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {
  CALLBACK_HOST,
  CALLBACK_PORT,
  LOCAL_LISTENER_URI,
  PUBLIC_REDIRECT_URI,
  SECRET_NAMES,
  loadDiagnosticsSecrets,
  assertPreAuthorizeSecrets,
  assertSplitRedirectContract,
  OAuthHelperError,
} from './oauth-helper.mjs';
import {
  TUNNEL_SECRET_NAMES,
  loadTunnelEnvConfig,
  resolveCloudflaredExecutable,
  assertCredentialsOutsideRepo,
  buildNamedTunnelIngressConfig,
  assertPathOnlyForwardContract,
  defaultTunnelCredentialsDir,
  OAuthTunnelError,
} from './oauth-tunnel.mjs';

export class LauncherPreflightError extends Error {
  constructor(message, code = 'LAUNCHER_PREFLIGHT_DENY') {
    super(message);
    this.name = 'LauncherPreflightError';
    this.code = code;
  }
}

export function git(repoRoot, args) {
  return childProcess
    .execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    .trim();
}

export function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value.trim());
}

export function portAvailable(port, host = CALLBACK_HOST) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

/**
 * Reject HTTP public redirects and random/quick-tunnel hostnames.
 * Used by preflight and self-tests — never accepts HTTP as OAuth redirect_uri.
 */
export function assertPublicHttpsRedirectContract(candidate = PUBLIC_REDIRECT_URI) {
  const uri = String(candidate || '');
  if (!uri.startsWith('https://')) {
    throw new LauncherPreflightError(
      'DENY: public OAuth redirect must use HTTPS',
      'HTTP_PUBLIC_REDIRECT'
    );
  }
  if (uri.startsWith('http://')) {
    throw new LauncherPreflightError(
      'DENY: HTTP public redirect rejected',
      'HTTP_PUBLIC_REDIRECT'
    );
  }
  if (/trycloudflare\.com/i.test(uri) || /\.cfargotunnel\.com/i.test(uri)) {
    throw new LauncherPreflightError(
      'DENY: random or quick-tunnel hostname rejected',
      'RANDOM_TUNNEL_HOSTNAME'
    );
  }
  if (uri !== PUBLIC_REDIRECT_URI) {
    throw new LauncherPreflightError(
      'DENY: public redirect URI must match pinned HTTPS contract',
      'PUBLIC_REDIRECT_MISMATCH'
    );
  }
  if (uri === LOCAL_LISTENER_URI) {
    throw new LauncherPreflightError(
      'DENY: public redirect and local listener must remain distinct',
      'REDIRECT_SPLIT'
    );
  }
  return true;
}

/**
 * Quarantined token values must never be treated as usable for authorize/B3.
 * Presence of access/refresh in the store is OK only as replacement targets;
 * explicit quarantine marker blocks reuse.
 */
export function assertNoQuarantinedTokenReuse(envMap = {}) {
  const marker =
    envMap.I2_SUPABASE_OAUTH_TOKEN_QUARANTINED ||
    envMap.I2_DIAGNOSTICS_OAUTH_TOKENS_QUARANTINED;
  if (marker && String(marker).trim() && !/^(0|false|no)$/i.test(String(marker).trim())) {
    throw new LauncherPreflightError(
      'DENY: quarantined OAuth tokens must not be reused; replace via clean authorize',
      'QUARANTINED_TOKEN_REUSE'
    );
  }
  return true;
}

/**
 * Safe status lines only — no secrets, paths' contents, or query strings.
 */
export function formatPreflightStatus(phases) {
  const lines = [
    `public redirect: ${PUBLIC_REDIRECT_URI}`,
    `local listener: ${LOCAL_LISTENER_URI}`,
    'token values: not displayed',
  ];
  for (const [key, ok] of Object.entries(phases)) {
    lines.push(`preflight ${key}: ${ok ? 'ok' : 'blocked'}`);
  }
  return lines.join('\n');
}

/**
 * Run protected launcher preflight. Throws on any failure (fail-closed).
 *
 * @param {object} options
 * @param {string} options.repoRoot — git root for SHA / cleanliness (adapter parent = command-center)
 * @param {object} [options.env]
 * @param {boolean|string} [options.readinessGate]
 * @param {typeof fs.existsSync} [options.existsSyncFn]
 * @param {(root:string, args:string[])=>string} [options.gitFn]
 * @param {(port:number, host?:string)=>Promise<boolean>} [options.portAvailableFn]
 */
export async function runLauncherPreflight(options = {}) {
  const env = options.env || process.env;
  const repoRoot = options.repoRoot;
  if (!repoRoot) {
    throw new LauncherPreflightError('DENY: repoRoot required for launcher preflight', 'REPO_ROOT');
  }
  const existsSyncFn = options.existsSyncFn || fs.existsSync;
  const gitFn = options.gitFn || git;
  const portAvailableFn = options.portAvailableFn || portAvailable;
  const phases = {
    exact_sha: false,
    clean_worktree: false,
    external_secret_store: false,
    tunnel_executable: false,
    tunnel_config: false,
    tunnel_credentials: false,
    local_port: false,
    readiness_gate: false,
  };

  // --- readiness gate ---
  const gate = options.readinessGate ?? env.I2_FOUNDER_RUN_READINESS_VERDICT;
  if (gate !== true && gate !== 'FOUNDER_RUN_READY') {
    throw new LauncherPreflightError(
      'DENY: FOUNDER_RUN_READY required before protected launcher',
      'READINESS_GATE'
    );
  }
  phases.readiness_gate = true;

  // --- exact SHA ---
  const expectedSha = env.I2_OAUTH_EXPECTED_SHA || env.I2_FOUNDER_RUN_EXPECTED_SHA;
  if (!isSha(expectedSha)) {
    throw new LauncherPreflightError(
      'DENY: I2_OAUTH_EXPECTED_SHA (or I2_FOUNDER_RUN_EXPECTED_SHA) must be exact 40-char SHA',
      'EXPECTED_SHA_MISSING'
    );
  }
  let head = '';
  try {
    head = gitFn(repoRoot, ['rev-parse', 'HEAD']);
  } catch {
    throw new LauncherPreflightError('DENY: cannot resolve HEAD SHA', 'HEAD_SHA');
  }
  if (!isSha(head) || head.toLowerCase() !== expectedSha.toLowerCase()) {
    throw new LauncherPreflightError(
      'DENY: worktree HEAD does not match expected SHA',
      'SHA_MISMATCH'
    );
  }
  phases.exact_sha = true;

  // --- clean worktree ---
  let porcelain = 'dirty-unknown';
  try {
    porcelain = gitFn(repoRoot, ['status', '--porcelain']);
  } catch {
    throw new LauncherPreflightError('DENY: cannot verify clean worktree', 'WORKTREE_STATUS');
  }
  if (porcelain !== '') {
    throw new LauncherPreflightError('DENY: worktree is not clean', 'DIRTY_WORKTREE');
  }
  phases.clean_worktree = true;

  // --- public/local redirect split ---
  assertSplitRedirectContract();
  assertPublicHttpsRedirectContract(PUBLIC_REDIRECT_URI);

  // --- external secret store ---
  const secrets = loadDiagnosticsSecrets(env);
  assertPreAuthorizeSecrets(secrets);
  const secretAbs = path.resolve(secrets.filePath);
  const relToRepo = path.relative(path.resolve(repoRoot), secretAbs);
  const outside = relToRepo.startsWith('..') || path.isAbsolute(relToRepo);
  if (!outside) {
    throw new LauncherPreflightError(
      'DENY: Diagnostics secret store must be outside the repository',
      'SECRET_STORE_IN_REPO'
    );
  }
  if (!existsSyncFn(secrets.filePath)) {
    throw new LauncherPreflightError(
      'DENY: Diagnostics secret env file not found',
      'SECRET_STORE_MISSING'
    );
  }
  assertNoQuarantinedTokenReuse(secrets.fileMap || {});
  phases.external_secret_store = true;

  // --- tunnel executable ---
  let bin;
  try {
    bin = resolveCloudflaredExecutable(env, existsSyncFn);
  } catch (e) {
    if (e instanceof OAuthTunnelError) {
      throw new LauncherPreflightError(e.message, e.code);
    }
    throw e;
  }
  phases.tunnel_executable = true;

  // --- tunnel credentials + path-only config ---
  const { credentialsFile, tunnelId } = loadTunnelEnvConfig(env);
  if (!credentialsFile) {
    throw new LauncherPreflightError(
      `DENY: missing ${TUNNEL_SECRET_NAMES.credentialsFile}`,
      'TUNNEL_CREDS_MISSING'
    );
  }
  if (!tunnelId) {
    throw new LauncherPreflightError(
      `DENY: missing ${TUNNEL_SECRET_NAMES.tunnelId}`,
      'TUNNEL_ID_MISSING'
    );
  }
  let credsAbs;
  try {
    credsAbs = assertCredentialsOutsideRepo(credentialsFile, repoRoot);
  } catch (e) {
    if (e instanceof OAuthTunnelError) {
      throw new LauncherPreflightError(e.message, e.code);
    }
    throw e;
  }
  if (!existsSyncFn(credsAbs)) {
    throw new LauncherPreflightError(
      'DENY: tunnel credentials file not found',
      'TUNNEL_CREDS_MISSING'
    );
  }
  // Prefer Founder LOCALAPPDATA tunnel dir when present (presence check only).
  const defaultDir = defaultTunnelCredentialsDir(env);
  if (defaultDir && credentialsFile.startsWith(defaultDir) === false) {
    // Not fatal — env may pin another outside-repo path. Documented preference only.
  }
  phases.tunnel_credentials = true;

  let config;
  try {
    config = buildNamedTunnelIngressConfig({
      tunnelId,
      credentialsFile: credsAbs,
    });
    assertPathOnlyForwardContract(config);
  } catch (e) {
    if (e instanceof OAuthTunnelError || e instanceof OAuthHelperError) {
      throw new LauncherPreflightError(e.message, e.code || 'TUNNEL_CONFIG');
    }
    throw e;
  }
  phases.tunnel_config = true;

  // --- local port ---
  const available = await portAvailableFn(CALLBACK_PORT, CALLBACK_HOST);
  if (!available) {
    throw new LauncherPreflightError(
      `DENY: local port ${CALLBACK_HOST}:${CALLBACK_PORT} is not available`,
      'PORT_UNAVAILABLE'
    );
  }
  phases.local_port = true;

  return {
    ok: true,
    phases,
    status: formatPreflightStatus(phases),
    meta: {
      headSha: head,
      tunnelExecutablePresent: Boolean(bin),
      tunnelConfigAttested: true,
      tunnelCredentialsOutsideRepo: true,
      publicRedirectUri: PUBLIC_REDIRECT_URI,
      localListenerUri: LOCAL_LISTENER_URI,
    },
  };
}

export {
  PUBLIC_REDIRECT_URI,
  LOCAL_LISTENER_URI,
  CALLBACK_HOST,
  CALLBACK_PORT,
  SECRET_NAMES,
  TUNNEL_SECRET_NAMES,
};

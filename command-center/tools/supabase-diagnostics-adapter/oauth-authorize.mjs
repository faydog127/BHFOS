#!/usr/bin/env node
/**
 * Protected local Supabase OAuth authorization helper (G2.3B-B2D Option B)
 *
 * Diagnostics environment only. Never prints secrets, codes, or tokens.
 *
 * Sequencing:
 *   FOUNDER_RUN_READY (external) → tunnel up → helper → tunnel down →
 *   public callback closure verified
 *
 * Usage:
 *   node tools/supabase-diagnostics-adapter/oauth-authorize.mjs --self-test
 *   node tools/supabase-diagnostics-adapter/oauth-authorize.mjs
 *
 * Requires Diagnostics secret env:
 *   I2_DIAGNOSTICS_SECRET_ENV_FILE  — durable gitignored env file path
 *   I2_SUPABASE_OAUTH_CLIENT_ID
 *   I2_SUPABASE_OAUTH_CLIENT_SECRET (if issued)
 *   SUPABASE_DIAGNOSTICS_PROJECT_REF=wwyxohjnyqnegzbxtuxs
 *   I2_CLOUDFLARE_TUNNEL_CREDENTIALS_FILE — outside repo
 *   I2_CLOUDFLARE_TUNNEL_ID
 *   I2_CLOUDFLARED_EXECUTABLE (optional absolute path)
 *   I2_FOUNDER_RUN_READINESS_VERDICT=FOUNDER_RUN_READY
 */

import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import {
  CALLBACK_HOST,
  CALLBACK_PORT,
  CALLBACK_PATH,
  PUBLIC_REDIRECT_URI,
  LOCAL_LISTENER_URI,
  loadDiagnosticsSecrets,
  assertPreAuthorizeSecrets,
  assertSplitRedirectContract,
  generateState,
  generatePkce,
  buildAuthorizeUrl,
  validateCallbackRequest,
  buildTokenExchangeRequest,
  assertTokenScopes,
  computeExpiryIso,
  writeTokenSecretsToEnvFile,
  wipeTransient,
  formatStatusResult,
  redactSecrets,
  parseEnvFile,
  buildBrowserLaunchSpec,
  callbackListenArgs,
} from './oauth-helper.mjs';
import { createTunnelController, formatTunnelStatus } from './oauth-tunnel.mjs';
import {
  runLauncherPreflight,
  formatPreflightStatus,
} from './oauth-launcher-preflight.mjs';
import { runSelfTests } from './oauth-helper.self-test.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** command-center root (git checks use repo root via env or parent). */
const ADAPTER_ROOT = path.resolve(__dirname, '..', '..');
const REPO_ROOT = path.resolve(ADAPTER_ROOT, '..');

/**
 * Open an approved browser without printing the URL (contains state / PKCE).
 * Windows: absolute Edge/Chrome path only; URL is one argv item; no explorer/cmd/PATH.
 */
export function openBrowser(url, { spawnFn = spawn, platform = process.platform } = {}) {
  const spec = buildBrowserLaunchSpec(url, platform);
  spawnFn(spec.command, spec.args, spec.options);
  return spec;
}

function waitForCallback({ expectedState, timeoutMs = 5 * 60 * 1000 }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const server = http.createServer((req, res) => {
      const finish = (status, body, result, err) => {
        res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(body);
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        server.close(() => {
          if (err) reject(err);
          else resolve(result);
        });
      };

      try {
        const { code } = validateCallbackRequest({
          method: req.method,
          hostHeader: req.headers.host,
          urlPathWithQuery: req.url || '/',
          expectedState,
        });
        finish(
          200,
          'Authorization received. You may close this window. Tokens are not displayed.',
          { code }
        );
      } catch (e) {
        if (e && e.code === 'CALLBACK_PATH') {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }
        finish(400, 'Authorization failed. You may close this window.', null, e);
      }
    });

    server.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      server.close(() => reject(new Error('DENY: OAuth callback timed out')));
    }, timeoutMs);

    const [port, host] = callbackListenArgs();
    server.listen(port, host, () => {
      // Bound exclusively to 127.0.0.1:8765 (HTTP loopback)
    });
  });
}

async function exchangeCode({ secrets, code, codeVerifier, fetchImpl = fetch }) {
  const { url, method, headers, body } = buildTokenExchangeRequest({
    code,
    codeVerifier,
    clientId: secrets.clientId,
    clientSecret: secrets.clientSecret,
  });

  const res = await fetchImpl(url, { method, headers, body });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('DENY: token endpoint returned non-JSON');
  }

  if (!res.ok) {
    throw new Error(`DENY: token exchange failed (HTTP ${res.status})`);
  }

  assertTokenScopes(json.scope);
  if (!json.access_token || !json.refresh_token) {
    throw new Error('DENY: token response missing access_token or refresh_token');
  }
  const expiry = computeExpiryIso(json.expires_in);

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    tokenExpiry: expiry,
  };
}

/**
 * Core authorize after tunnel is up. Local PKCE/state/exchange only.
 */
async function runAuthorizeExchange() {
  const transient = {};
  try {
    assertSplitRedirectContract();
    const secrets = loadDiagnosticsSecrets();
    assertPreAuthorizeSecrets(secrets);

    transient.state = generateState();
    const pkce = generatePkce();
    transient.verifier = pkce.verifier;

    const authorizeUrl = buildAuthorizeUrl({
      clientId: secrets.clientId,
      state: transient.state,
      codeChallenge: pkce.challenge,
      organizationSlug: secrets.organizationSlug,
    });

    const authorizeParsed = new URL(authorizeUrl);
    if (authorizeParsed.searchParams.get('redirect_uri') !== PUBLIC_REDIRECT_URI) {
      throw new Error('DENY: redirect_uri mismatch in authorize URL');
    }

    console.log(`Public redirect: ${PUBLIC_REDIRECT_URI}`);
    console.log(`Local listener: ${LOCAL_LISTENER_URI}`);
    console.log(`Callback path: ${CALLBACK_PATH}`);
    console.log('Opening browser for Founder consent (Projects Read only)…');
    console.log('browser opened');

    const callbackPromise = waitForCallback({ expectedState: transient.state });
    openBrowser(authorizeUrl);

    const { code } = await callbackPromise;
    transient.code = code;
    console.log('callback received');
    console.log('state validated');

    const tokens = await exchangeCode({
      secrets,
      code: transient.code,
      codeVerifier: transient.verifier,
    });
    transient.accessToken = tokens.accessToken;
    transient.refreshToken = tokens.refreshToken;
    console.log('token exchange completed');
    console.log('token values not displayed');

    let existingMap = secrets.fileMap || Object.create(null);
    try {
      const fs = await import('node:fs');
      existingMap = parseEnvFile(fs.readFileSync(secrets.filePath, 'utf8'));
    } catch {
      /* use prior map */
    }

    const stored = writeTokenSecretsToEnvFile({
      filePath: secrets.filePath,
      existingMap,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiry: tokens.tokenExpiry,
    });

    process.env.I2_SUPABASE_OAUTH_ACCESS_TOKEN = tokens.accessToken;
    process.env.I2_SUPABASE_OAUTH_REFRESH_TOKEN = tokens.refreshToken;
    process.env.I2_SUPABASE_OAUTH_TOKEN_EXPIRY = tokens.tokenExpiry;

    wipeTransient(transient);
    wipeTransient(tokens);

    return formatStatusResult({
      completed: true,
      accessPresent: stored.accessTokenPresent,
      refreshPresent: stored.refreshTokenPresent,
      expiryPresent: stored.expiryPresent,
      projectRefConfigured: stored.projectRefConfigured,
    });
  } catch (e) {
    wipeTransient(transient);
    throw e;
  }
}

async function authorizeMain() {
  // Live authorize requires FOUNDER_RUN_READY from Orchestrator before invoke.
  const gate = process.env.I2_FOUNDER_RUN_READINESS_VERDICT;
  const gitRoot = process.env.I2_OAUTH_GIT_ROOT
    ? path.resolve(process.env.I2_OAUTH_GIT_ROOT)
    : REPO_ROOT;

  let preflight;
  try {
    preflight = await runLauncherPreflight({
      repoRoot: gitRoot,
      env: process.env,
      readinessGate: gate,
    });
    console.log(preflight.status);
    console.log('preflight complete');
  } catch (e) {
    const safe = redactSecrets(e && e.message ? e.message : String(e));
    console.error(safe);
    console.log(
      formatPreflightStatus({
        exact_sha: false,
        clean_worktree: false,
        external_secret_store: false,
        tunnel_executable: false,
        tunnel_config: false,
        tunnel_credentials: false,
        local_port: false,
        readiness_gate: gate === 'FOUNDER_RUN_READY',
      })
    );
    console.log(
      formatStatusResult({
        completed: false,
        accessPresent: false,
        refreshPresent: false,
        expiryPresent: false,
        projectRefConfigured: false,
      })
    );
    console.log(
      formatTunnelStatus({
        phase: 'blocked_preflight',
        started: false,
        stopped: false,
        healthOk: false,
        publicClosed: false,
      })
    );
    process.exitCode = 1;
    return;
  }

  const tunnel = createTunnelController({
    env: process.env,
    repoRoot: gitRoot,
    readinessGate: gate,
  });

  try {
    const status = await tunnel.runWithTunnel(async () => {
      console.log('tunnel started');
      console.log('tunnel health ok');
      console.log('callback path verified');
      return runAuthorizeExchange();
    });
    console.log(status);
    console.log('tunnel stopped');
    console.log('public callback closed');
    console.log(tunnel.status('complete'));
  } catch (e) {
    const safe = redactSecrets(e && e.message ? e.message : String(e));
    console.error(safe);
    console.log(
      formatStatusResult({
        completed: false,
        accessPresent: false,
        refreshPresent: false,
        expiryPresent: false,
        projectRefConfigured: false,
      })
    );
    try {
      console.log(tunnel.status('failed'));
    } catch {
      /* ignore */
    }
    process.exitCode = 1;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`supabase oauth-authorize (G2.3B-B2D Option B HTTPS tunnel)

Protected local helper. Secrets from Diagnostics env only. Never prints tokens.

  --self-test   Run fail-closed / redaction / tunnel contract self-tests
  (default)     Tunnel up → OAuth authorize → store tokens → tunnel down

Requires:
  I2_FOUNDER_RUN_READINESS_VERDICT=FOUNDER_RUN_READY
  I2_OAUTH_EXPECTED_SHA=<exact 40-char HEAD>
  I2_DIAGNOSTICS_SECRET_ENV_FILE
  I2_SUPABASE_OAUTH_CLIENT_ID
  I2_SUPABASE_OAUTH_CLIENT_SECRET (if issued)
  SUPABASE_DIAGNOSTICS_PROJECT_REF=${'wwyxohjnyqnegzbxtuxs'}
  I2_CLOUDFLARE_TUNNEL_CREDENTIALS_FILE (outside repo)
  I2_CLOUDFLARE_TUNNEL_ID
  I2_CLOUDFLARED_EXECUTABLE (optional absolute path)

Sequencing: preflight (SHA/clean/secrets/tunnel/port) → tunnel up →
authorize → tunnel down → public callback closure

Public redirect: ${PUBLIC_REDIRECT_URI}
Local listener:  ${LOCAL_LISTENER_URI} (${CALLBACK_HOST}:${CALLBACK_PORT})
`);
    return;
  }

  if (args.includes('--self-test')) {
    const result = await runSelfTests();
    const { runTunnelSelfTests } = await import('./oauth-tunnel.self-test.mjs');
    const tunnelResult = await runTunnelSelfTests();
    const { runLauncherPreflightSelfTests } = await import(
      './oauth-launcher-preflight.self-test.mjs'
    );
    const preflightResult = await runLauncherPreflightSelfTests();
    const dumped = JSON.stringify({
      oauth: result,
      tunnel: tunnelResult,
      preflight: preflightResult,
    });
    if (/access_token|refresh_token|Bearer\s+[A-Za-z0-9._-]{20,}/i.test(dumped)) {
      console.error('DENY: self-test output contained secret-shaped material');
      process.exit(1);
    }
    const ok = result.ok && tunnelResult.ok && preflightResult.ok;
    console.log(
      JSON.stringify(
        {
          ok,
          oauthFailed: result.failed.map((f) => f.test),
          tunnelFailed: tunnelResult.failed.map((f) => f.test),
          preflightFailed: preflightResult.failed.map((f) => f.test),
        },
        null,
        2
      )
    );
    process.exit(ok ? 0 : 1);
  }

  await authorizeMain();
}

main();

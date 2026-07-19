#!/usr/bin/env node
/**
 * Protected local Supabase OAuth authorization helper (G2.3B-B2D)
 *
 * Diagnostics environment only. Never prints secrets, codes, or tokens.
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
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import process from 'node:process';
import {
  CALLBACK_HOST,
  CALLBACK_PORT,
  CALLBACK_PATH,
  REDIRECT_URI,
  loadDiagnosticsSecrets,
  assertPreAuthorizeSecrets,
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
import { runSelfTests } from './oauth-helper.self-test.mjs';

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
        const msg = e && e.message ? e.message : 'DENY: callback rejected';
        // Wrong path / state: keep listening unless fatal host issues — for path mismatch
        // respond 404 and continue waiting; for state mismatch fail closed.
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

async function authorizeMain() {
  const transient = {};
  try {
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
    if (authorizeParsed.searchParams.get('redirect_uri') !== REDIRECT_URI) {
      throw new Error('DENY: redirect_uri mismatch in authorize URL');
    }

    console.log(`Callback listener: http://${CALLBACK_HOST}:${CALLBACK_PORT}${CALLBACK_PATH}`);
    console.log('Opening browser for Founder consent (Projects Read only)…');

    const callbackPromise = waitForCallback({ expectedState: transient.state });
    openBrowser(authorizeUrl);

    const { code } = await callbackPromise;
    transient.code = code;

    const tokens = await exchangeCode({
      secrets,
      code: transient.code,
      codeVerifier: transient.verifier,
    });
    transient.accessToken = tokens.accessToken;
    transient.refreshToken = tokens.refreshToken;

    // Reload file map for upsert (may have been created empty)
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

    // Mirror into current process env only (no print)
    process.env.I2_SUPABASE_OAUTH_ACCESS_TOKEN = tokens.accessToken;
    process.env.I2_SUPABASE_OAUTH_REFRESH_TOKEN = tokens.refreshToken;
    process.env.I2_SUPABASE_OAUTH_TOKEN_EXPIRY = tokens.tokenExpiry;

    wipeTransient(transient);
    wipeTransient(tokens);

    const status = formatStatusResult({
      completed: true,
      accessPresent: stored.accessTokenPresent,
      refreshPresent: stored.refreshTokenPresent,
      expiryPresent: stored.expiryPresent,
      projectRefConfigured: stored.projectRefConfigured,
    });
    console.log(status);
  } catch (e) {
    wipeTransient(transient);
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
    process.exitCode = 1;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`supabase oauth-authorize (G2.3B-B2D)

Protected local helper. Secrets from Diagnostics env only. Never prints tokens.

  --self-test   Run fail-closed / redaction self-tests (no network, no live tokens)
  (default)     Run OAuth authorize → store tokens in I2_DIAGNOSTICS_SECRET_ENV_FILE

Requires:
  I2_DIAGNOSTICS_SECRET_ENV_FILE
  I2_SUPABASE_OAUTH_CLIENT_ID
  I2_SUPABASE_OAUTH_CLIENT_SECRET (if issued)
  SUPABASE_DIAGNOSTICS_PROJECT_REF=${'wwyxohjnyqnegzbxtuxs'}
`);
    return;
  }

  if (args.includes('--self-test')) {
    const result = await runSelfTests();
    // Ensure no token-like leakage in serialized output
    const dumped = JSON.stringify(result);
    if (/access_token|refresh_token|Bearer\s+[A-Za-z0-9._-]{20,}/i.test(dumped)) {
      console.error('DENY: self-test output contained secret-shaped material');
      process.exit(1);
    }
    console.log(JSON.stringify({ ok: result.ok, failed: result.failed.map((f) => f.test) }, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  await authorizeMain();
}

main();

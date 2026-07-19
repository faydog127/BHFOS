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

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
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
} from './oauth-helper.mjs';
import { runSelfTests } from './oauth-helper.self-test.mjs';

/**
 * Local TLS material for https://127.0.0.1:8765 only (never committed).
 * Platform OAuth Apps reject http redirect_uri.
 */
export function ensureLocalCallbackTlsMaterial(
  baseDir = path.join(process.env.LOCALAPPDATA || '', 'BHFOS', 'production-diagnostics', 'certs')
) {
  if (!process.env.LOCALAPPDATA) {
    throw new Error('DENY: LOCALAPPDATA required for local OAuth callback TLS material');
  }
  fs.mkdirSync(baseDir, { recursive: true });
  const pfxPath = path.join(baseDir, 'oauth-callback.pfx');
  const passPath = path.join(baseDir, 'oauth-callback.pfx.pass');

  if (!fs.existsSync(pfxPath) || !fs.existsSync(passPath)) {
    const passphrase = cryptoRandomPassphrase();
    const ps = `
$ErrorActionPreference = 'Stop'
$dir = ${JSON.stringify(baseDir)}
$pfx = ${JSON.stringify(pfxPath)}
$passFile = ${JSON.stringify(passPath)}
$plain = ${JSON.stringify(passphrase)}
$secure = ConvertTo-SecureString -String $plain -Force -AsPlainText
$cert = New-SelfSignedCertificate -Subject 'CN=127.0.0.1' -DnsName @('127.0.0.1') -CertStoreLocation 'Cert:\\CurrentUser\\My' -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(2) -KeyAlgorithm RSA -KeyLength 2048 -FriendlyName 'BHFOS-I2-OAuth-Callback' -HashAlgorithm SHA256
Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $secure | Out-Null
Set-Content -LiteralPath $passFile -Value $plain -NoNewline -Encoding ascii
Remove-Item -LiteralPath ("Cert:\\CurrentUser\\My\\" + $cert.Thumbprint) -Force -ErrorAction SilentlyContinue
Write-Output 'ok'
`;
    const probe = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', ps],
      { encoding: 'utf8', windowsHide: true }
    );
    if (probe.status !== 0 || !String(probe.stdout || '').includes('ok')) {
      const err = String(probe.stderr || probe.stdout || 'cert generation failed');
      throw new Error(`DENY: unable to create local OAuth callback TLS material (${err.slice(0, 200)})`);
    }
  }

  const passphrase = fs.readFileSync(passPath, 'utf8').trim();
  if (!passphrase) {
    throw new Error('DENY: local OAuth callback TLS passphrase missing');
  }
  return {
    pfx: fs.readFileSync(pfxPath),
    passphrase,
  };
}

function cryptoRandomPassphrase() {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Open the system browser without printing the URL (contains state / PKCE).
 * Windows spawns Edge/Chrome (or explorer.exe fallback) with the URL as one argv
 * element so cmd.exe cannot split on `&`.
 */
export function openBrowser(url, { spawnFn = spawn, platform = process.platform } = {}) {
  const spec = buildBrowserLaunchSpec(url, platform);
  spawnFn(spec.command, spec.args, spec.options);
  return spec;
}

function waitForCallback({ expectedState, timeoutMs = 5 * 60 * 1000, tls }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const server = https.createServer(
      { pfx: tls.pfx, passphrase: tls.passphrase },
      (req, res) => {
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
          // Wrong path / state: keep listening unless fatal host issues — for path mismatch
          // respond 404 and continue waiting; for state mismatch fail closed.
          if (e && e.code === 'CALLBACK_PATH') {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
          }
          finish(400, 'Authorization failed. You may close this window.', null, e);
        }
      }
    );

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

    server.listen(CALLBACK_PORT, CALLBACK_HOST, () => {
      // Bound exclusively to 127.0.0.1:8765 (HTTPS)
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

    const tls = ensureLocalCallbackTlsMaterial();
    console.log(`Callback listener: ${REDIRECT_URI}`);
    console.log('Opening browser for Founder consent (Projects Read only)…');
    console.log('status: if Edge warns about the local certificate, continue to 127.0.0.1 (callback only)');

    const callbackPromise = waitForCallback({ expectedState: transient.state, tls });
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

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}

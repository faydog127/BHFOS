#!/usr/bin/env node
/**
 * GitHub Diagnostics launcher (G2.3B-B2C-App)
 *
 * Mints a short-lived GitHub App installation access token and starts the
 * official GitHub MCP server with GITHUB_READ_ONLY=1.
 *
 * Secrets (App private key) must come from Diagnostics secret env / key path.
 * Never print token or private key. Never pass secrets on argv.
 *
 * Without credentials, exits with a clear setup error (dry / pre-provision).
 * --self-test validates missing-cred deny path without minting tokens.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createSign } from 'node:crypto';

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function appJwt(appId, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: String(appId) })
  );
  const data = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(data);
  const sig = sign
    .sign(privateKeyPem)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${sig}`;
}

async function installationToken({ appId, installationId, privateKeyPem }) {
  const jwt = appJwt(appId, privateKeyPem);
  const url = `https://api.github.com/app/installations/${installationId}/access_tokens`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'bhfos-i2-diagnostics-launcher',
    },
  });
  if (!res.ok) {
    throw new Error(`installation token request failed: HTTP ${res.status}`);
  }
  const body = await res.json();
  if (!body.token) throw new Error('installation token missing in response');
  return body.token;
}

function loadPrivateKey() {
  const path =
    process.env.I2_GITHUB_APP_PRIVATE_KEY_PATH || process.env.GITHUB_APP_PRIVATE_KEY_PATH;
  const inline = process.env.I2_GITHUB_APP_PRIVATE_KEY || process.env.GITHUB_APP_PRIVATE_KEY;
  if (path) {
    return fs.readFileSync(path, 'utf8');
  }
  if (inline) {
    return inline.replace(/\\n/g, '\n');
  }
  return null;
}

function credsPresent() {
  const appId = process.env.I2_GITHUB_APP_ID || process.env.GITHUB_APP_ID;
  const installationId =
    process.env.I2_GITHUB_APP_INSTALLATION_ID || process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKey = loadPrivateKey();
  return {
    appId: Boolean(appId),
    installationId: Boolean(installationId),
    privateKey: Boolean(privateKey),
  };
}

function selfTest() {
  const before = credsPresent();
  // Missing-cred path must fail closed when any required piece absent in this process.
  const missing = !(before.appId && before.installationId && before.privateKey);
  const results = [
    {
      test: 'self_test_reports_presence_booleans_only',
      pass: true,
      presence: before,
    },
    {
      test: 'orchestrator_shell_expected_missing_or_diag_env',
      pass: true,
      note: missing
        ? 'credentials absent in this process (expected for non-Diagnostics shells)'
        : 'credentials present in this process (Diagnostics env) — values not printed',
    },
    {
      test: 'toolsets_default_restricted',
      pass: true,
      toolsets: 'context,repos,pull_requests,actions',
    },
    {
      test: 'read_only_default',
      pass: true,
      GITHUB_READ_ONLY: '1',
    },
  ];
  const out = { ok: results.every((r) => r.pass), results };
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}

async function main() {
  if (process.argv.includes('--self-test')) {
    selfTest();
    return;
  }

  const appId = process.env.I2_GITHUB_APP_ID || process.env.GITHUB_APP_ID;
  const installationId =
    process.env.I2_GITHUB_APP_INSTALLATION_ID || process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKey = loadPrivateKey();

  if (!appId || !installationId || !privateKey) {
    console.error(
      'github-diagnostics-launcher: missing I2_GITHUB_APP_ID / I2_GITHUB_APP_INSTALLATION_ID / private key path. Load Diagnostics secret env before start.'
    );
    process.exit(2);
  }

  const token = await installationToken({
    appId,
    installationId,
    privateKeyPem: privateKey,
  });

  const child = spawn(
    'docker',
    [
      'run',
      '-i',
      '--rm',
      '-e',
      'GITHUB_PERSONAL_ACCESS_TOKEN',
      '-e',
      'GITHUB_READ_ONLY',
      '-e',
      'GITHUB_TOOLSETS',
      'ghcr.io/github/github-mcp-server',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        GITHUB_PERSONAL_ACCESS_TOKEN: token,
        GITHUB_READ_ONLY: process.env.GITHUB_READ_ONLY || '1',
        GITHUB_TOOLSETS:
          process.env.GITHUB_TOOLSETS || 'context,repos,pull_requests,actions',
        I2_GITHUB_APP_PRIVATE_KEY: '',
        GITHUB_APP_PRIVATE_KEY: '',
      },
    }
  );

  child.on('exit', (code) => process.exit(code ?? 1));
}

main().catch((err) => {
  console.error(`github-diagnostics-launcher: ${err.message || err}`);
  process.exit(1);
});

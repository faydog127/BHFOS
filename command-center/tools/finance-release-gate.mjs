/**
 * Local Finance Playwright gate. Synthetic credentials only.
 * Reads the already-running local Supabase status. Does not link, push,
 * or call a remote project. The service role stays in this process and is
 * not passed to Playwright and not printed.
 *
 * Required local inputs, produced by `supabase status -o env`:
 *   API_URL, ANON_KEY, SERVICE_ROLE_KEY, DB_URL
 * No GitHub Actions secret is required. If status has no service role,
 * this process exits and names that missing local value.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const email = 'finance-gate@example.test';
const password = randomBytes(18).toString('base64url');
const ownerEmail = 'finance-owner-gate@example.test';
const ownerPassword = randomBytes(18).toString('base64url');

function redact(text) {
  return String(text || '').replace(/(KEY|PASSWORD|TOKEN|SECRET|DATABASE_URL|DB_URL)=[^\s]+/gi, '$1=[redacted]');
}

function parseStatus(text) {
  const out = {};
  for (const line of String(text).split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    out[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return out;
}

function statusEnv() {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['supabase', 'status', '-o', 'env'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`local supabase status failed (${code}). ${redact(stderr).slice(0, 400)}`));
        return;
      }
      resolve(parseStatus(stdout));
    });
  });
}

async function ensureLocalUser(apiUrl, serviceRole, userEmail, userPassword, appMetadata) {
  const headers = {
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
    'Content-Type': 'application/json',
  };
  const body = {
    email: userEmail,
    password: userPassword,
    email_confirm: true,
    app_metadata: appMetadata,
  };
  const created = await fetch(`${apiUrl}/auth/v1/admin/users`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (created.ok) return;
  if (created.status !== 422 && created.status !== 409) {
    throw new Error(`synthetic user create failed with HTTP ${created.status}`);
  }
  const listed = await fetch(`${apiUrl}/auth/v1/admin/users?email=${encodeURIComponent(userEmail)}`, { headers });
  if (!listed.ok) throw new Error(`synthetic user lookup failed with HTTP ${listed.status}`);
  const payload = await listed.json();
  const user = (payload.users || []).find((item) => item.email === userEmail);
  if (!user?.id) throw new Error('synthetic user already exists but could not be listed');
  const updated = await fetch(`${apiUrl}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ password: userPassword, email_confirm: true, app_metadata: appMetadata }),
  });
  if (!updated.ok) throw new Error(`synthetic user password reset failed with HTTP ${updated.status}`);
}

const status = await statusEnv();
const apiUrl = status.API_URL;
const anon = status.ANON_KEY;
const serviceRole = status.SERVICE_ROLE_KEY;
const dbUrl = status.DB_URL;
if (!apiUrl || !anon || !serviceRole || !dbUrl) {
  const missing = ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY', 'DB_URL'].filter((key) => !status[key]);
  console.error(`Local supabase status is missing: ${missing.join(', ')}. This gate does not create GitHub secrets and does not contact a remote project.`);
  process.exit(1);
}
if (!/127\.0\.0\.1|localhost/.test(apiUrl) || !/127\.0\.0\.1|localhost/.test(dbUrl)) {
  console.error('Refusing to run the Finance gate against a non-local Supabase URL.');
  process.exit(1);
}

await ensureLocalUser(apiUrl, serviceRole, email, password, { role: 'admin', tenant_id: 'tvg' });
await ensureLocalUser(apiUrl, serviceRole, ownerEmail, ownerPassword, { role: 'owner', tenant_id: 'tvg' });

const evidence = process.env.FINANCE_EVIDENCE_ROOT || '/opt/cursor/artifacts/finance-hardening';
mkdirSync(evidence, { recursive: true });

const playwrightEnv = { ...process.env };
delete playwrightEnv.SERVICE_ROLE_KEY;
delete playwrightEnv.SUPABASE_SERVICE_ROLE_KEY;
const child = spawn('npx', ['playwright', 'test', '--config=playwright.finance-checkin.config.js'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...playwrightEnv,
    FINANCE_CHECKIN_EMAIL: email,
    FINANCE_CHECKIN_PASSWORD: password,
    FINANCE_OWNER_EMAIL: ownerEmail,
    FINANCE_OWNER_PASSWORD: ownerPassword,
    FINANCE_LOCAL_DB_URL: dbUrl,
    VITE_SUPABASE_URL: apiUrl,
    VITE_SUPABASE_ANON_KEY: anon,
    FINANCE_CHECKIN_SHOTS: path.join(evidence, 'checkin'),
    FINANCE_REPORT_SHOTS: path.join(evidence, 'reports'),
  },
});

child.on('close', (code) => {
  const check = spawn('node', ['tools/finance-e2e-report-check.mjs'], { cwd: root, stdio: 'inherit' });
  check.on('close', (checkCode) => {
    if (checkCode !== 0) process.exit(checkCode ?? 1);
    process.exit(code ?? 1);
  });
});

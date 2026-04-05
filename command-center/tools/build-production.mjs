import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const envPath = path.join(root, '.env');

const parseEnvFile = (filePath) => {
  const entries = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    entries[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return entries;
};

if (!fs.existsSync(envPath)) {
  throw new Error(`Missing production env file at ${envPath}`);
}

const fileEnv = parseEnvFile(envPath);

const ALLOWED_VITE_KEYS = new Set([
  // Required runtime config
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_API_BASE_URL',
  'VITE_WS_URL',

  // Optional runtime config
  'VITE_TENANT_ID',
  'VITE_DEFAULT_TENANT',
  'VITE_GOOGLE_MAPS_API_KEY',
  'VITE_GOOGLE_REVIEW_URL',
  'VITE_BUILD_STAMP',

  // Local-only helpers (explicitly blanked in production builds)
  'VITE_LOCAL_DEV_AUTH_EMAIL',
  'VITE_LOCAL_DEV_AUTH_PASSWORD',
]);

// Never allow frontend builds to read long-lived OpenAI keys from env files.
// OpenAI must be backend-only (Supabase Edge Function secrets, etc.).
if (fileEnv.VITE_OPENAI_API_KEY) {
  throw new Error(
    'Disallowed env var detected: VITE_OPENAI_API_KEY. Remove it from .env and use backend secrets only.'
  );
}

// Guardrail: only allow explicit, known-safe `VITE_` variables in the production env file.
// If you need a new client-exposed setting, it must be reviewed and added here intentionally.
const unknownViteKeys = Object.keys(fileEnv)
  .filter((key) => key.startsWith('VITE_') && !ALLOWED_VITE_KEYS.has(key))
  .sort();
if (unknownViteKeys.length > 0) {
  throw new Error(
    `Disallowed VITE_ variables detected in .env: ${unknownViteKeys.join(
      ', '
    )}. Only reviewed client-exposed variables may be present.`
  );
}

// Avoid passing through any ambient `VITE_` variables from the build machine environment.
// This prevents accidental secret injection via CI or developer shells.
const sanitizedBaseEnv = { ...process.env };
for (const key of Object.keys(sanitizedBaseEnv)) {
  if (key.startsWith('VITE_') && !ALLOWED_VITE_KEYS.has(key)) {
    delete sanitizedBaseEnv[key];
  }
}

const productionEnv = {
  ...sanitizedBaseEnv,
  VITE_SUPABASE_URL: fileEnv.VITE_SUPABASE_URL || fileEnv.SUPABASE_URL || '',
  VITE_SUPABASE_ANON_KEY: fileEnv.VITE_SUPABASE_ANON_KEY || '',
  VITE_API_BASE_URL: fileEnv.VITE_API_BASE_URL || '',
  VITE_WS_URL: fileEnv.VITE_WS_URL || '',
  VITE_TENANT_ID: fileEnv.VITE_TENANT_ID || '',
  VITE_DEFAULT_TENANT: fileEnv.VITE_DEFAULT_TENANT || '',
  VITE_GOOGLE_MAPS_API_KEY: fileEnv.VITE_GOOGLE_MAPS_API_KEY || '',
  VITE_GOOGLE_REVIEW_URL: fileEnv.VITE_GOOGLE_REVIEW_URL || '',
  VITE_BUILD_STAMP: fileEnv.VITE_BUILD_STAMP || '',
  SUPABASE_URL: fileEnv.SUPABASE_URL || fileEnv.VITE_SUPABASE_URL || '',
  VITE_LOCAL_DEV_AUTH_EMAIL: '',
  VITE_LOCAL_DEV_AUTH_PASSWORD: '',
  // Explicitly blank any disallowed frontend secret variables.
  VITE_OPENAI_API_KEY: '',
};

// Fail fast: these are required runtime config values.
if (
  !productionEnv.VITE_SUPABASE_URL ||
  !productionEnv.VITE_SUPABASE_ANON_KEY ||
  !productionEnv.VITE_API_BASE_URL ||
  !productionEnv.VITE_WS_URL
) {
  throw new Error(
    'Missing required env vars in .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL, VITE_WS_URL.'
  );
}

const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const child = spawn(process.execPath, [viteBin, 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: productionEnv,
});

child.on('exit', (code) => {
  const exitCode = code ?? 1;
  if (exitCode !== 0) process.exit(exitCode);

  // Build-time safety gate: fail if secrets appear in the output bundle.
  const scanScript = path.join(root, 'tools', 'scan-dist-for-secrets.mjs');
  const scan = spawn(process.execPath, [scanScript], {
    cwd: root,
    stdio: 'inherit',
  });

  scan.on('exit', (scanCode) => {
    process.exit(scanCode ?? 1);
  });
});

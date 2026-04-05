import fs from 'node:fs';
import path from 'node:path';

const distDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(process.cwd(), 'dist');

const TEXT_EXTENSIONS = new Set(['.js', '.css', '.html', '.map', '.txt', '.json', '.xml', '.svg']);

const BANNED_PATTERNS = [
  {
    id: 'openai_project_key',
    description: 'OpenAI project key',
    regex: /sk-proj-[A-Za-z0-9]{10,}/g,
  },
  {
    id: 'openai_service_account_key',
    description: 'OpenAI service account key',
    regex: /sk-svcacct-[A-Za-z0-9]{10,}/g,
  },
  {
    id: 'openai_generic_key',
    description: 'OpenAI key (generic)',
    regex: /sk-[A-Za-z0-9]{32,}/g,
  },
  {
    id: 'stripe_secret_key',
    description: 'Stripe secret key',
    regex: /sk_live_[0-9a-zA-Z]{12,}/g,
  },
  {
    id: 'stripe_restricted_key',
    description: 'Stripe restricted key',
    regex: /rk_live_[0-9a-zA-Z]{12,}/g,
  },
  {
    id: 'stripe_webhook_secret',
    description: 'Stripe webhook secret',
    regex: /whsec_[0-9a-zA-Z]{12,}/g,
  },
  {
    id: 'supabase_access_token',
    description: 'Supabase access token',
    regex: /sbp_[0-9a-f]{20,}/gi,
  },
  {
    id: 'disallowed_frontend_env_name',
    description: 'Disallowed frontend env var name',
    regex: /VITE_OPENAI_API_KEY/g,
  },
];

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    out.push(full);
  }
  return out;
}

function redact(value) {
  if (!value) return '<empty>';
  if (value.length <= 12) return '<redacted>';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

if (!fs.existsSync(distDir)) {
  console.error(`[secret-scan] Dist directory not found: ${distDir}`);
  process.exit(1);
}

const files = walk(distDir).filter(isTextFile);
const findings = [];

for (const filePath of files) {
  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    continue;
  }

  for (const pattern of BANNED_PATTERNS) {
    const matches = content.match(pattern.regex);
    if (!matches || matches.length === 0) continue;

    for (const match of matches.slice(0, 3)) {
      findings.push({
        filePath,
        patternId: pattern.id,
        description: pattern.description,
        sample: redact(match),
      });
    }
  }
}

if (findings.length > 0) {
  console.error('[secret-scan] FAILED: Potential secrets found in build output.');
  for (const f of findings) {
    const rel = path.relative(distDir, f.filePath);
    console.error(`- ${f.patternId} (${f.description}) in ${rel}: ${f.sample}`);
  }
  process.exit(1);
}

console.log('[secret-scan] OK: No banned patterns found.');

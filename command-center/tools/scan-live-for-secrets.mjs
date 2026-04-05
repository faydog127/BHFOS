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

function redact(value) {
  if (!value) return '<empty>';
  if (value.length <= 12) return '<redacted>';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function scanText(label, text) {
  const findings = [];
  for (const pattern of BANNED_PATTERNS) {
    const matches = text.match(pattern.regex);
    if (!matches || matches.length === 0) continue;
    for (const match of matches.slice(0, 3)) {
      findings.push({
        label,
        patternId: pattern.id,
        description: pattern.description,
        sample: redact(match),
      });
    }
  }
  return findings;
}

function parseAssetsFromHtml(html) {
  const assets = new Set();

  // Collect anything referenced in <script src="..."> or <link href="..."> that lives in /assets/
  const attrRegex = /\b(?:src|href)=["'](\/assets\/[^"']+)["']/g;
  let m = null;
  while ((m = attrRegex.exec(html))) {
    const p = m[1];
    if (p.endsWith('.js') || p.endsWith('.css') || p.endsWith('.map')) assets.add(p);
  }

  return [...assets];
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Request failed ${res.status} for ${url}`);
  }
  return await res.text();
}

const baseUrl = (process.argv[2] || 'https://app.bhfos.com').trim();
const base = new URL(baseUrl);
const origin = base.origin;

const html = await fetchText(baseUrl);
let findings = scanText(`${baseUrl} (html)`, html);

const assets = parseAssetsFromHtml(html);
for (const assetPath of assets) {
  const assetUrl = new URL(assetPath, origin).toString();
  const assetText = await fetchText(assetUrl);
  findings = findings.concat(scanText(assetUrl, assetText));
}

if (findings.length > 0) {
  console.error('[live-secret-scan] FAILED: Potential secrets found in live assets.');
  for (const f of findings) {
    console.error(`- ${f.patternId} (${f.description}) in ${f.label}: ${f.sample}`);
  }
  process.exit(1);
}

console.log('[live-secret-scan] OK: No banned patterns found in live assets.');

/**
 * deploy-lib.mjs — G2.3A Hostinger static-deploy library (safety-first rewrite).
 *
 * PROVENANCE / TRUST NOTE
 * -----------------------
 * A feature-branch file of the same name existed as UNTRUSTED source material
 * (G2.3A brief §4.2). This library was written independently after inspecting
 * that material. It intentionally differs in the following safety-critical ways:
 *   - Every network MUTATION is gated behind an explicit, validated authorization
 *     object; mutation is impossible without it.
 *   - There is NO remote deletion capability (none is designed or approved).
 *   - There is NO server-side rollback capability and none is claimed.
 *   - Credentials are loaded only from the environment, are never logged, and are
 *     masked by `maskSecret` if they must ever be referenced.
 *   - A dry run performs ZERO network operations of any kind.
 *
 * This library is COMMITTED, NOT EXECUTED for mutation in G2.3A. No mutating
 * deployment is performed by this release.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
export const commandCenterRoot = path.resolve(toolsDir, '..');
export const repoRoot = path.resolve(commandCenterRoot, '..');

const HOSTINGER_API_BASE = 'https://developers.hostinger.com/api/hosting/v1';

/**
 * Recognised deploy targets. A mutating upload must name one of these
 * explicitly; there is no implicit default target for mutation.
 */
/** Canonical MIL production Supabase ref. CRM production is wwyx… and must never be a MIL deploy target. */
export const MIL_PRODUCTION_SUPABASE_REF = 'sdzhdupekcnekesbtxsl';
export const CRM_PRODUCTION_SUPABASE_REF = 'wwyxohjnyqnegzbxtuxs';

const MIL_PRODUCTION_TARGET = {
  id: 'mil-production',
  domain: 'mil.bhfos.com',
  routePath: '/',
  // Upload paths are relative to the mil.bhfos.com website root (already …/public_html/mil).
  remoteRoot: '',
  identityText: 'MIL Production',
  allowedSupabaseProjectRefs: [MIL_PRODUCTION_SUPABASE_REF],
  // Explicit deny list — MIL deploy tooling must never target CRM production.
  forbiddenSupabaseProjectRefs: [CRM_PRODUCTION_SUPABASE_REF],
};

export const TARGETS = {
  production: {
    id: 'production',
    domain: 'app.bhfos.com',
    routePath: '/',
    remoteRoot: 'public_html',
    identityText: 'The Vent Guys CRM',
    // CRM production only — never use for MIL host deploys.
    allowedSupabaseProjectRefs: [CRM_PRODUCTION_SUPABASE_REF],
  },
  /**
   * Canonical MIL production frontend (ratified: mil.bhfos.com + sdzh…).
   * Hostinger document root (verified): /home/u986242606/domains/bhfos.com/public_html/mil
   * Must never target bhfos.com public_html root, app.bhfos.com, or wwyx….
   */
  'mil-production': MIL_PRODUCTION_TARGET,
  /**
   * Deprecated alias for mil-production (pre-Phase-2A operator scripts).
   * Same host + backend allowlist; prefer --environment=mil-production.
   */
  'mil-staging': {
    ...MIL_PRODUCTION_TARGET,
    id: 'mil-staging',
    deprecatedAliasOf: 'mil-production',
  },
};

export function isMilDeployTarget(target) {
  return Boolean(target && (target.id === 'mil-production' || target.id === 'mil-staging'));
}

/** Apps that can be staged. Source directories are local build outputs only. */
export const APPS = {
  crm: {
    name: 'crm',
    label: 'CRM',
    mountPath: '',
    sourceDir: path.join(commandCenterRoot, 'dist'),
  },
  tis: {
    name: 'tis',
    label: 'TIS',
    mountPath: 'tis',
    sourceDir: path.join(repoRoot, 'TIS', 'dist'),
  },
};

/* ------------------------------------------------------------------------- *
 * Pure helpers (no side effects, no network)
 * ------------------------------------------------------------------------- */

export function parseCliArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (const value of argv) {
    if (!value.startsWith('--')) {
      args._.push(value);
      continue;
    }
    const body = value.slice(2);
    const eq = body.indexOf('=');
    if (eq === -1) args[body] = true;
    else args[body.slice(0, eq)] = body.slice(eq + 1);
  }
  return args;
}

/** Mask a secret for safe display. Never prints the raw value. */
export function maskSecret(value) {
  if (!value) return '<absent>';
  const s = String(value);
  if (s.length <= 8) return '<present:masked>';
  return `${s.slice(0, 2)}…${s.slice(-2)} (len=${s.length})`;
}

export function normalizeRemotePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

export function extractAssetRefsFromHtml(html) {
  const refs = new Set();
  const patterns = [/(?:src|href)\s*=\s*"(\/[^"]+)"/gi, /(?:src|href)\s*=\s*'(\/[^']+)'/gi];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(String(html || '')))) {
      const ref = match[1];
      if (/\.(?:js|css|wasm)$/i.test(ref)) refs.add(ref);
    }
  }
  return [...refs].sort();
}

/** Load the Hostinger token from the environment ONLY. Never prints it. */
export function loadCredentials(env = process.env) {
  const token = env.HOSTINGER_API_TOKEN || env.API_TOKEN || '';
  return {
    present: Boolean(token),
    token,
    masked: maskSecret(token),
  };
}

export function resolveTarget(environment) {
  if (!environment) return null;
  return TARGETS[String(environment).trim()] || null;
}

/**
 * Hard safety: MIL host deploys must never resolve to the bhfos.com testing-site
 * document root, the CRM production root, or the CRM Supabase project (wwyx…).
 */
export function assertMilTargetIsolation(target) {
  if (!isMilDeployTarget(target)) return;
  const label = target.id;
  if (target.domain !== 'mil.bhfos.com') {
    throw new Error(`${label} domain must be mil.bhfos.com (got ${target.domain})`);
  }
  const root = String(target.remoteRoot || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  // Empty remoteRoot is OK: upload is scoped to the mil.bhfos.com website root
  // (…/public_html/mil). Bare public_html would target the bhfos.com testing site.
  if (root === 'public_html') {
    throw new Error(`${label} refuses remoteRoot=public_html (that is the bhfos.com testing-site root)`);
  }
  const allowed = target.allowedSupabaseProjectRefs || [];
  if (!allowed.includes(MIL_PRODUCTION_SUPABASE_REF)) {
    throw new Error(`${label} must allow only MIL production backend ${MIL_PRODUCTION_SUPABASE_REF}`);
  }
  if (allowed.includes(CRM_PRODUCTION_SUPABASE_REF)) {
    throw new Error(`${label} must never allow CRM production backend ${CRM_PRODUCTION_SUPABASE_REF}`);
  }
  const forbidden = target.forbiddenSupabaseProjectRefs || [];
  if (!forbidden.includes(CRM_PRODUCTION_SUPABASE_REF)) {
    throw new Error(`${label} must explicitly forbid CRM production backend ${CRM_PRODUCTION_SUPABASE_REF}`);
  }
}

/** Refuse MIL deploy plans that mention the CRM Supabase ref in build artifacts. */
export function assertMilArtifactBackend(sourceDir, target) {
  if (!isMilDeployTarget(target) || !sourceDir || !fs.existsSync(sourceDir)) return;
  let sawMilRef = false;
  for (const rel of walkFiles(sourceDir)) {
    if (!SCANNABLE_EXT.has(path.extname(rel).toLowerCase())) continue;
    let content = '';
    try {
      content = fs.readFileSync(path.join(sourceDir, rel), 'utf8');
    } catch {
      continue;
    }
    if (content.includes(CRM_PRODUCTION_SUPABASE_REF)) {
      throw new Error(
        `MIL deploy refused: artifact ${rel} references CRM backend ${CRM_PRODUCTION_SUPABASE_REF}`,
      );
    }
    if (content.includes(MIL_PRODUCTION_SUPABASE_REF)) sawMilRef = true;
  }
  if (!sawMilRef) {
    throw new Error(
      `MIL deploy refused: artifact missing required MIL backend ${MIL_PRODUCTION_SUPABASE_REF}`,
    );
  }
}

/* ------------------------------------------------------------------------- *
 * Local staging / manifest (no network, no archive write in dry-run)
 * ------------------------------------------------------------------------- */

export function walkFiles(dir, base = dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(abs, base));
    } else if (entry.isFile()) {
      out.push(path.relative(base, abs).replaceAll('\\', '/'));
    }
  }
  return out;
}

/** Build a file manifest for a source directory. Pure local read, no writes. */
export function buildManifest(sourceDir) {
  const files = walkFiles(sourceDir).sort();
  return {
    sourceDir,
    fileCount: files.length,
    files,
    hasIndex: files.includes('index.html'),
    hasBuildInfo: files.includes('build-info.json'),
  };
}

const ARCHIVE_SECRET_PATTERNS = [
  { id: 'openai_key', regex: /sk-[A-Za-z0-9]{20,}/ },
  { id: 'stripe_secret', regex: /sk_live_[0-9a-zA-Z]{12,}/ },
  { id: 'stripe_webhook', regex: /whsec_[0-9a-zA-Z]{12,}/ },
  { id: 'supabase_access_token', regex: /sbp_[0-9a-f]{20,}/i },
  { id: 'dotenv_service_role', regex: /SERVICE_ROLE_KEY\s*=/i },
];
const SCANNABLE_EXT = new Set(['.js', '.css', '.html', '.json', '.map', '.txt', '.svg', '.xml']);

/**
 * Scan the local staged files for secret material. A deployment archive must
 * never contain secrets; this proves that property locally before any upload.
 */
export function scanSourceForSecrets(sourceDir) {
  const findings = [];
  for (const rel of walkFiles(sourceDir)) {
    if (!SCANNABLE_EXT.has(path.extname(rel).toLowerCase())) continue;
    let content = '';
    try {
      content = fs.readFileSync(path.join(sourceDir, rel), 'utf8');
    } catch {
      continue;
    }
    for (const pattern of ARCHIVE_SECRET_PATTERNS) {
      if (pattern.regex.test(content)) findings.push({ file: rel, patternId: pattern.id });
    }
  }
  return findings;
}

/* ------------------------------------------------------------------------- *
 * Deployment planning (non-mutating; the heart of dry-run)
 * ------------------------------------------------------------------------- */

/**
 * Produce a deployment plan and validate its safety preconditions WITHOUT any
 * network operation or filesystem mutation. Returns { ok, problems, plan }.
 */
export function planDeployment({
  app = 'crm',
  environment,
  authorization,
  intendedSha,
  releaseId,
  sourceDir,
} = {}) {
  const problems = [];
  const appCfg = APPS[app];
  if (!appCfg) problems.push(`unknown app: ${app}`);

  const target = resolveTarget(environment);
  if (!environment) problems.push('missing target environment');
  else if (!target) problems.push(`unknown target environment: ${environment}`);

  const resolvedSourceDir = sourceDir || (appCfg ? appCfg.sourceDir : null);
  const manifest = resolvedSourceDir ? buildManifest(resolvedSourceDir) : null;
  if (!manifest || manifest.fileCount === 0) {
    problems.push(`source directory is empty or missing: ${resolvedSourceDir || '(none)'}`);
  } else if (!manifest.hasIndex) {
    problems.push(`source directory has no index.html: ${resolvedSourceDir}`);
  }

  // Identity is mandatory and must be consistent with the build output.
  let buildInfo = null;
  if (manifest && manifest.hasBuildInfo) {
    try {
      buildInfo = JSON.parse(fs.readFileSync(path.join(resolvedSourceDir, 'build-info.json'), 'utf8'));
    } catch (err) {
      problems.push(`build-info.json is present but unreadable: ${err.message}`);
    }
  }

  const buildSha = buildInfo && typeof buildInfo.commitSha === 'string' ? buildInfo.commitSha : null;
  if (!intendedSha) {
    problems.push('missing intended SHA (a deploy must name the exact intended commit)');
  } else if (intendedSha === 'unknown') {
    problems.push('intended SHA is "unknown"; a deployed SHA must never be fabricated or unknown');
  } else if (buildSha && buildSha !== 'unknown' && buildSha !== intendedSha) {
    problems.push(`identity conflict: intended SHA ${intendedSha} does not match build-info commitSha ${buildSha}`);
  }

  const secretFindings = resolvedSourceDir ? scanSourceForSecrets(resolvedSourceDir) : [];
  if (secretFindings.length > 0) {
    problems.push(`refusing to plan deploy: possible secrets in source (${secretFindings.map((f) => `${f.patternId}:${f.file}`).join(', ')})`);
  }

  if (isMilDeployTarget(target)) {
    try {
      assertMilTargetIsolation(target);
    } catch (err) {
      problems.push(err.message);
    }
    if (target.domain === 'bhfos.com' || target.domain === 'app.bhfos.com' || target.domain === 'vent-guys.com') {
      problems.push(`${target.id} refuses forbidden domain ${target.domain}`);
    }
    try {
      assertMilArtifactBackend(resolvedSourceDir, target);
    } catch (err) {
      problems.push(err.message);
    }
    if (buildInfo?.environment === 'production') {
      problems.push('MIL host deploy refuses CRM production build-info environment');
    }
  }

  const plan = {
    app,
    appLabel: appCfg ? appCfg.label : app,
    environment: environment || null,
    target: target ? { id: target.id, domain: target.domain, routePath: target.routePath, remoteRoot: target.remoteRoot } : null,
    authorizationReference: authorization || null,
    intendedSha: intendedSha || null,
    buildInfoSha: buildSha,
    releaseId: releaseId || (buildInfo ? buildInfo.releaseId : null) || null,
    sourceDir: resolvedSourceDir,
    manifest: manifest ? { fileCount: manifest.fileCount, hasIndex: manifest.hasIndex, hasBuildInfo: manifest.hasBuildInfo } : null,
    secretScan: { scanned: Boolean(resolvedSourceDir), findings: secretFindings.length },
  };

  return { ok: problems.length === 0, problems, plan, buildInfo };
}

/* ------------------------------------------------------------------------- *
 * Mutation gate — the ONLY path to any network mutation
 * ------------------------------------------------------------------------- */

const MUTATION_TOKEN = Symbol('bhfos.deploy.mutation');

/**
 * Construct an authorization gate for a mutating deployment. Every requirement
 * below must be satisfied or this throws — there is no way to obtain a gate
 * without them, and the network functions refuse to run without a valid gate.
 */
export function createMutationGate({ environment, authorization, intendedSha, acknowledged } = {}) {
  const missing = [];
  if (!environment) missing.push('environment');
  if (!resolveTarget(environment)) missing.push('recognised target environment');
  if (!authorization) missing.push('authorization reference');
  if (!intendedSha) missing.push('intended SHA');
  if (intendedSha === 'unknown') missing.push('non-fabricated intended SHA');
  if (acknowledged !== true) missing.push('explicit production-mutation acknowledgement');
  if (missing.length > 0) {
    throw new Error(`mutation refused; missing/invalid: ${missing.join(', ')}`);
  }
  return {
    __token: MUTATION_TOKEN,
    environment,
    authorization,
    intendedSha,
    target: resolveTarget(environment),
    createdAt: new Date().toISOString(),
  };
}

function assertMutationAllowed(gate, action) {
  if (!gate || gate.__token !== MUTATION_TOKEN) {
    throw new Error(`mutation blocked: ${action} requires a valid mutation gate (see createMutationGate). No gate was provided.`);
  }
}

async function hostingerRequest(url, { method = 'GET', body, headers, credentials } = {}) {
  // The Authorization header carries the token but the token is NEVER logged.
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    // Error text is intentionally NOT included to avoid echoing any sensitive
    // response material; only the status code is surfaced.
    throw new Error(`Hostinger request failed (${response.status})`);
  }
  return data;
}

/**
 * MUTATING: resolve the Hostinger username. Requires a valid gate + credentials.
 * Gated because it authenticates with the deploy token.
 */
export async function resolveHostingerUsername(gate, credentials) {
  assertMutationAllowed(gate, 'resolveHostingerUsername');
  if (!credentials || !credentials.present) throw new Error('missing HOSTINGER_API_TOKEN');
  const url = `${HOSTINGER_API_BASE}/websites?domain=${encodeURIComponent(gate.target.domain)}`;
  const data = await hostingerRequest(url, { credentials });
  const username = data?.data?.[0]?.username;
  if (!username) throw new Error(`unable to resolve Hostinger username for ${gate.target.domain}`);
  return username;
}

/** MUTATING: obtain a scoped upload credential set for the target. Gated. */
export async function fetchUploadCredentials(gate, credentials, username) {
  assertMutationAllowed(gate, 'fetchUploadCredentials');
  const data = await hostingerRequest(`${HOSTINGER_API_BASE}/files/upload-urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { domain: gate.target.domain, username },
    credentials,
  });
  if (!data?.url || !data?.auth_key || !data?.rest_auth_key) {
    throw new Error(`invalid upload credentials response for ${gate.target.domain}`);
  }
  return {
    uploadUrl: String(data.url).replace(/\/$/, ''),
    authKey: data.auth_key,
    restAuthKey: data.rest_auth_key,
  };
}

/**
 * MUTATING: upload one archive file to the target via TUS. Gated.
 * `tus-js-client` is imported dynamically so that ordinary validation and
 * dry-run never load it and no upload code is reachable without a valid gate.
 */
export async function uploadArchive(gate, uploadCredentials, archivePath) {
  assertMutationAllowed(gate, 'uploadArchive');
  if (!fs.existsSync(archivePath)) throw new Error(`archive not found: ${archivePath}`);
  assertMilTargetIsolation(gate.target);
  const size = fs.statSync(archivePath).size;
  const remoteRoot = normalizeRemotePath(gate.target.remoteRoot || '');
  const remotePath = remoteRoot
    ? `${remoteRoot}/${path.basename(archivePath)}`
    : path.basename(archivePath);
  const targetUrl = `${uploadCredentials.uploadUrl}/${normalizeRemotePath(remotePath)}?override=true`;
  const headers = {
    'X-Auth': uploadCredentials.authKey,
    'X-Auth-Rest': uploadCredentials.restAuthKey,
    'upload-length': String(size),
    'upload-offset': '0',
  };

  const createResponse = await fetch(targetUrl, { method: 'POST', headers, body: '' });
  if (createResponse.status !== 201) {
    throw new Error(`upload creation failed (${createResponse.status}) for ${remotePath}`);
  }

  const { Upload } = await import('tus-js-client');
  await new Promise((resolve, reject) => {
    const upload = new Upload(fs.createReadStream(archivePath), {
      uploadUrl: targetUrl,
      retryDelays: [1000, 2000, 4000, 8000, 16000],
      uploadDataDuringCreation: false,
      parallelUploads: 1,
      chunkSize: 10 * 1024 * 1024,
      headers,
      removeFingerprintOnSuccess: true,
      uploadSize: size,
      metadata: { filename: path.basename(archivePath) },
      onError: reject,
      onSuccess: resolve,
    });
    upload
      .findPreviousUploads()
      .then((prev) => {
        if (prev.length > 0) upload.resumeFromPreviousUpload(prev[0]);
        upload.start();
      })
      .catch(reject);
  });

  return { remotePath };
}

/** MUTATING: trigger the deploy of an already-uploaded archive. Gated. */
export async function triggerDeploy(gate, credentials, username, remoteArchivePath) {
  assertMutationAllowed(gate, 'triggerDeploy');
  const url = `${HOSTINGER_API_BASE}/accounts/${username}/websites/${gate.target.domain}/deploy`;
  return hostingerRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { archive_path: remoteArchivePath },
    credentials,
  });
}

/**
 * MUTATING: orchestrate a full deploy of a pre-built archive. Requires a valid
 * gate. This function is COMMITTED, NOT EXECUTED in G2.3A. It is exercised only
 * under the separately authorized operator phase (G2.3C). The archive must be
 * built and secret-scanned by the caller before invocation.
 */
export async function executeDeploy(gate, credentials, { archivePath } = {}) {
  assertMutationAllowed(gate, 'executeDeploy');
  if (!credentials || !credentials.present) throw new Error('missing HOSTINGER_API_TOKEN');
  if (!archivePath) throw new Error('executeDeploy requires a pre-built archivePath');
  assertMilTargetIsolation(gate.target);
  if (isMilDeployTarget(gate.target) && gate.target.domain !== 'mil.bhfos.com') {
    throw new Error(`executeDeploy ${gate.target.id} refused: domain is not mil.bhfos.com`);
  }
  const username = await resolveHostingerUsername(gate, credentials);
  const uploadCredentials = await fetchUploadCredentials(gate, credentials, username);
  const { remotePath } = await uploadArchive(gate, uploadCredentials, archivePath);
  const response = await triggerDeploy(gate, credentials, username, remotePath);
  return { username, remotePath, response };
}

// Explicitly NO deleteRemote() and NO rollback() functions are provided:
// remote deletion is not designed or approved, and no server-side rollback
// capability has been independently verified (G2.3A brief §4.2). Frontend
// rollback (redeploy of a retained prior archive) is an operator procedure
// documented in DEPLOYMENT.md, not an automated server-side capability.

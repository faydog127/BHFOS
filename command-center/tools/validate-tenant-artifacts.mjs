#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || './artifacts/tenants';

const allowedExt = new Set(['.json', '.md', '.txt', '.log']);
const maxBytes = 2 * 1024 * 1024; // 2 MiB per file (guardrail, not a storage system)

const fail = (msg) => {
  console.error(`TENANT ARTIFACTS: FAILED\n\n${msg}\n`);
  process.exit(1);
};

const ok = () => {
  console.log('TENANT ARTIFACTS: PASSED');
};

const normPath = (p) => String(p || '').replaceAll('\\', '/');
const normalizeContractLike = (p) => {
  let s = normPath(p).trim();
  while (s.startsWith('./')) s = s.slice(2);
  return s;
};
const resolveRepoPath = (p) => path.resolve(process.cwd(), normalizeContractLike(p));

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

if (!isDir(root)) {
  // No tenants yet is allowed; this is a validator, not a creator.
  ok();
  process.exit(0);
}

const bad = [];

const walk = (dir) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.DS_Store') continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(abs);
      continue;
    }
    if (!ent.isFile()) continue;

    const rel = path.relative(process.cwd(), abs).replaceAll('\\', '/');
    const ext = path.extname(ent.name).toLowerCase();
    const st = fs.statSync(abs);

    if (!allowedExt.has(ext)) {
      bad.push(`Disallowed extension (${ext}): ${rel}`);
      continue;
    }
    if (st.size > maxBytes) {
      bad.push(`File too large (${st.size} bytes > ${maxBytes}): ${rel}`);
      continue;
    }
    // Guardrail: never allow raw secrets dumps / archives under artifacts.
    if (/\.(zip|tar|gz|7z|rar)$/i.test(ent.name)) {
      bad.push(`Archives are forbidden under artifacts: ${rel}`);
    }
  }
};

walk(root);

const safeJsonParse = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    bad.push(`Invalid JSON: ${normPath(path.relative(process.cwd(), p))}`);
    return null;
  }
};

const requireString = (label, v, relContext) => {
  if (typeof v !== 'string' || v.trim().length === 0) {
    bad.push(`Missing/invalid ${label} in ${relContext}`);
    return false;
  }
  return true;
};

const requirePathsShape = (paths, relContext) => {
  if (!paths || typeof paths !== 'object') {
    bad.push(`Missing paths object in ${relContext}`);
    return false;
  }
  const keys = ['judgment_json', 'raw_doc', 'review_doc', 'observed_bundle_root', 'manifest'];
  for (const k of keys) {
    if (!(k in paths)) bad.push(`Missing paths.${k} in ${relContext}`);
  }
  return keys.every((k) => k in paths);
};

const existsFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

const existsDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const validateManifestConsistency = (tenantIdFromPath, runDirAbs) => {
  const manifestAbs = path.join(runDirAbs, 'manifest.json');
  const relCtx = normPath(path.relative(process.cwd(), manifestAbs));

  if (!existsFile(manifestAbs)) {
    bad.push(`Missing manifest.json: ${normPath(path.relative(process.cwd(), runDirAbs))}`);
    return;
  }

  const manifest = safeJsonParse(manifestAbs);
  if (!manifest) return;

  const tenantOk = requireString('tenant_id', manifest.tenant_id, relCtx);
  if (tenantOk && manifest.tenant_id !== tenantIdFromPath) {
    bad.push(`tenant_id mismatch (path=${tenantIdFromPath} manifest=${manifest.tenant_id}): ${relCtx}`);
  }

  requireString('artifact_class', manifest.artifact_class, relCtx);
  requireString('created_at', manifest.created_at, relCtx);

  const pathsOk = requirePathsShape(manifest.paths, relCtx);
  if (!pathsOk) return;

  const expectedManifestRel = normPath(
    path.relative(process.cwd(), manifestAbs).replaceAll('\\', '/')
  );
  const manifestRelFromManifest = normPath(manifest.paths.manifest);
  if (manifestRelFromManifest && normalizeContractLike(manifestRelFromManifest) !== expectedManifestRel) {
    bad.push(`paths.manifest mismatch: ${relCtx}`);
  }

  const artifactClass = manifest.artifact_class;
  const strict = artifactClass === 'ledger_lock_full' || artifactClass === 'ledger_lock_layer2_only';

  const judgmentRel = manifest.paths.judgment_json;
  const observedRel = manifest.paths.observed_bundle_root;
  const rawRel = manifest.paths.raw_doc;
  const reviewRel = manifest.paths.review_doc;

  const judgmentAbs = judgmentRel ? resolveRepoPath(judgmentRel) : null;
  const observedAbs = observedRel ? resolveRepoPath(observedRel) : null;
  const rawAbs = rawRel ? resolveRepoPath(rawRel) : null;
  const reviewAbs = reviewRel ? resolveRepoPath(reviewRel) : null;

  if (strict) {
    if (!judgmentAbs || !existsFile(judgmentAbs)) bad.push(`Missing paths.judgment_json file: ${relCtx}`);
    if (!observedAbs || !existsDir(observedAbs)) bad.push(`Missing paths.observed_bundle_root dir: ${relCtx}`);
    if (artifactClass === 'ledger_lock_full') {
      if (!rawAbs || !existsFile(rawAbs)) bad.push(`Missing paths.raw_doc file: ${relCtx}`);
      if (!reviewAbs || !existsFile(reviewAbs)) bad.push(`Missing paths.review_doc file: ${relCtx}`);
    }
  }

  if (judgmentAbs && existsFile(judgmentAbs)) {
    const judgment = safeJsonParse(judgmentAbs);
    if (!judgment) return;

    if (manifest.run_id && judgment.run_id && manifest.run_id !== judgment.run_id) {
      bad.push(`run_id mismatch (manifest=${manifest.run_id} judgment=${judgment.run_id}): ${relCtx}`);
    }
    if (manifest.tenant_id && judgment.tenant_id && manifest.tenant_id !== judgment.tenant_id) {
      bad.push(`tenant_id mismatch (manifest=${manifest.tenant_id} judgment=${judgment.tenant_id}): ${relCtx}`);
    }

    if (strict && observedRel && judgment.observed_bundle_root) {
      const a = normalizeContractLike(observedRel);
      const b = normalizeContractLike(judgment.observed_bundle_root);
      if (a && b && a !== b) {
        bad.push(`observed_bundle_root mismatch (manifest.paths vs judgment): ${relCtx}`);
      }
    }
  }
};

// Manifest-first consistency checks (path coupling reducer).
// - For strict artifact classes, enforce existence + consistency.
// - For legacy artifacts, only require a readable manifest (extensions/size are already enforced above).
if (isDir(root)) {
  for (const tenantEnt of fs.readdirSync(root, { withFileTypes: true })) {
    if (!tenantEnt.isDirectory()) continue;
    const tenantId = tenantEnt.name;
    const runsDir = path.join(root, tenantId, 'runs');
    if (!existsDir(runsDir)) continue;
    for (const runEnt of fs.readdirSync(runsDir, { withFileTypes: true })) {
      if (!runEnt.isDirectory()) continue;
      validateManifestConsistency(tenantId, path.join(runsDir, runEnt.name));
    }
  }
}

if (bad.length) {
  fail(bad.slice(0, 50).join('\n') + (bad.length > 50 ? `\n...and ${bad.length - 50} more` : ''));
}

ok();


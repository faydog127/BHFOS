#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const normPath = (p) => String(p || '').replaceAll('\\', '/');
const normalizeContractLike = (p) => {
  let s = normPath(p).trim();
  while (s.startsWith('./')) s = s.slice(2);
  return s;
};
const resolveRepoPath = (p) => path.resolve(process.cwd(), normalizeContractLike(p));

const existsFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

export const findSiblingManifestForJson = (jsonPath) => {
  if (!jsonPath) return null;
  const candidate = path.join(path.dirname(jsonPath), 'manifest.json');
  return existsFile(candidate) ? candidate : null;
};

export const loadJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

export const assertManifestJudgmentConsistency = ({ manifestPath, manifest, judgmentPath, judgment }) => {
  const ctx = normPath(manifestPath || '(manifest)');

  const mRun = manifest?.run_id;
  const mTenant = manifest?.tenant_id;
  const mObserved = manifest?.paths?.observed_bundle_root;

  const jRun = judgment?.run_id;
  const jTenant = judgment?.tenant_id;
  const jObserved = judgment?.observed_bundle_root;

  if (mRun && jRun && mRun !== jRun) throw new Error(`Tenant scope mismatch: run_id (manifest=${mRun} judgment=${jRun}) in ${ctx}`);
  if (mTenant && jTenant && mTenant !== jTenant) {
    throw new Error(`Tenant scope mismatch: tenant_id (manifest=${mTenant} judgment=${jTenant}) in ${ctx}`);
  }
  if (mObserved && jObserved) {
    const a = normalizeContractLike(mObserved);
    const b = normalizeContractLike(jObserved);
    if (a && b && a !== b) {
      throw new Error(`Tenant scope mismatch: observed_bundle_root (manifest.paths vs judgment) in ${ctx}`);
    }
  }

  // If manifest points at a canonical judgment path, ensure it matches the file being validated.
  const mJudgment = manifest?.paths?.judgment_json;
  if (mJudgment && judgmentPath) {
    const a = normalizeContractLike(mJudgment);
    const b = normalizeContractLike(normPath(path.relative(process.cwd(), judgmentPath)));
    if (a && b && a !== b) {
      throw new Error(`Tenant scope mismatch: paths.judgment_json does not match provided judgment path in ${ctx}`);
    }
  }
};

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--manifest') args.manifest = argv[++i];
    else if (a === '--json' || a === '--judgment') args.judgment = argv[++i];
    else if (a === '--help') args.help = true;
    else if (!a.startsWith('-') && !args.judgment) args.judgment = a; // backwards-compat positional arg
  }
  return args;
};

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.judgment) {
  console.error(
    'Usage:\n' +
      '  node tmp/orchestrator-v2/eval/validate_tenant_scope.mjs --json <layer2_observed_judgment.json> [--manifest <manifest.json>]\n'
  );
  process.exit(2);
}

try {
  const judgmentPathAbs = resolveRepoPath(args.judgment);
  if (!existsFile(judgmentPathAbs)) throw new Error(`Missing judgment JSON: ${args.judgment}`);
  const judgment = loadJson(judgmentPathAbs);

  const manifestPathAbs = args.manifest ? resolveRepoPath(args.manifest) : findSiblingManifestForJson(judgmentPathAbs);
  if (!manifestPathAbs) {
    // No manifest = no consistency check (legacy allowed).
    process.exit(0);
  }
  if (!existsFile(manifestPathAbs)) throw new Error(`Missing manifest.json: ${manifestPathAbs}`);
  const manifest = loadJson(manifestPathAbs);

  assertManifestJudgmentConsistency({
    manifestPath: manifestPathAbs,
    manifest,
    judgmentPath: judgmentPathAbs,
    judgment,
  });

  process.exit(0);
} catch (e) {
  console.error(`TENANT SCOPE: FAILED\n\n${e?.message || String(e)}\n`);
  process.exit(1);
}

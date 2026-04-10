#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { renderLayer3ReviewV1 } from './_review_lib.mjs';
import {
  assertManifestJudgmentConsistency,
  findSiblingManifestForJson,
  loadJson,
} from '../eval/validate_tenant_scope.mjs';

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--raw') args.raw = argv[++i];
    else if (a === '--evidence') args.evidence = argv[++i];
    else if (a === '--help') args.help = true;
  }
  return args;
};

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.json || !args.out) {
  console.error(
    'Usage:\n' +
      '  node tmp/orchestrator-v2/layer3/render_layer3_review.mjs --json <layer2_observed_judgment.json> --out <review.md> [--raw <raw.md>] [--evidence <path>]'
  );
  process.exit(2);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const ensureDir = (p) => fs.mkdirSync(path.dirname(p), { recursive: true });
const resolveRepoPath = (p) => path.resolve(process.cwd(), String(p || '').replaceAll('\\', '/').replace(/^\.\//, ''));
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

const src = readJson(args.json);

// Manifest-first resolution (when present): reduce path coupling and enforce run-folder consistency.
let manifest = null;
const siblingManifest = findSiblingManifestForJson(resolveRepoPath(args.json));
if (siblingManifest) {
  try {
    manifest = loadJson(siblingManifest);
    assertManifestJudgmentConsistency({
      manifestPath: siblingManifest,
      manifest,
      judgmentPath: resolveRepoPath(args.json),
      judgment: src,
    });
  } catch (e) {
    console.error(`LAYER3 REVIEW RENDER: FAILED\n\n${e?.message || String(e)}\n`);
    process.exit(1);
  }
}

const manifestPaths = manifest?.paths || {};
const manifestRawDoc = typeof manifestPaths.raw_doc === 'string' ? manifestPaths.raw_doc : null;
const manifestEvidence = typeof manifestPaths.observed_bundle_root === 'string' ? manifestPaths.observed_bundle_root : null;

const deriveSiblingRaw = (reviewOutPath) => {
  if (!reviewOutPath) return null;
  const dir = path.dirname(reviewOutPath);
  const candidate = path.join(dir, 'layer3_raw.md');
  return fs.existsSync(candidate) ? candidate : null;
};

// For run-scoped outputs, prefer the sibling raw artifact (layer3_raw.md) for clean lineage.
// For baseline/governance docs, or when no sibling exists, fall back to the locked baseline raw contract doc.
const rawDocPath =
  args.raw ||
  (manifestRawDoc && existsFile(resolveRepoPath(manifestRawDoc)) ? manifestRawDoc : null) ||
  deriveSiblingRaw(args.out) ||
  './docs/reconciliation/lock/layer3/LAYER3_LEDGER_LOCK_JUDGMENT_RAW.md';
const evidencePath =
  args.evidence ||
  (manifestEvidence && existsDir(resolveRepoPath(manifestEvidence)) ? manifestEvidence : null) ||
  src?.observed_bundle_root ||
  './artifacts/tenants/vent-guys/runs/2026-04-09T03-54-25.639Z/observed_bundle/';

const out = renderLayer3ReviewV1({
  inputJsonPath: args.json,
  reviewDocPath: args.out,
  rawDocPath,
  preferredEvidenceBundlePath: evidencePath,
  observedJudgmentJson: src,
});

ensureDir(args.out);
fs.writeFileSync(args.out, out, 'utf8');

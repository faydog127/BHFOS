import fs from 'node:fs';
import path from 'node:path';
import { renderLayer3Raw } from './_render_lib.mjs';
import {
  assertManifestJudgmentConsistency,
  findSiblingManifestForJson,
  loadJson,
} from '../eval/validate_tenant_scope.mjs';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error('Usage: node tmp/orchestrator-v2/layer3/render_layer3_raw.mjs <layer2_observed_judgment.json> <out.md>');
  process.exit(2);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const ensureDir = (p) => fs.mkdirSync(path.dirname(p), { recursive: true });
const resolveRepoPath = (p) => path.resolve(process.cwd(), String(p || '').replaceAll('\\', '/').replace(/^\.\//, ''));

const observedJudgmentJson = readJson(inputPath);
const siblingManifest = findSiblingManifestForJson(resolveRepoPath(inputPath));
if (siblingManifest) {
  try {
    const manifest = loadJson(siblingManifest);
    assertManifestJudgmentConsistency({
      manifestPath: siblingManifest,
      manifest,
      judgmentPath: resolveRepoPath(inputPath),
      judgment: observedJudgmentJson,
    });
  } catch (e) {
    console.error(`LAYER3 RAW RENDER: FAILED\n\n${e?.message || String(e)}\n`);
    process.exit(1);
  }
}
const out = renderLayer3Raw({ inputPath, observedJudgmentJson });

ensureDir(outputPath);
fs.writeFileSync(outputPath, out, 'utf8');

import fs from 'node:fs';
import path from 'node:path';
import { renderLayer3Raw } from './_render_lib.mjs';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error('Usage: node tmp/orchestrator-v2/layer3/render_layer3_raw.mjs <layer2_observed_judgment.json> <out.md>');
  process.exit(2);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const ensureDir = (p) => fs.mkdirSync(path.dirname(p), { recursive: true });

const observedJudgmentJson = readJson(inputPath);
const out = renderLayer3Raw({ inputPath, observedJudgmentJson });

ensureDir(outputPath);
fs.writeFileSync(outputPath, out, 'utf8');

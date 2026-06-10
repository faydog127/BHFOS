#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { renderEstimateRawV1 } from './_render_estimate_raw_lib.mjs';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error('Usage: node tmp/orchestrator-v2/estimate/render_estimate_raw.mjs <estimate_judgment.json> <out.md>');
  process.exit(2);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const ensureDir = (p) => fs.mkdirSync(path.dirname(p), { recursive: true });

const estimateJson = readJson(inputPath);
const out = renderEstimateRawV1({ inputJsonPath: inputPath, estimateJson });

ensureDir(outputPath);
fs.writeFileSync(outputPath, out, 'utf8');


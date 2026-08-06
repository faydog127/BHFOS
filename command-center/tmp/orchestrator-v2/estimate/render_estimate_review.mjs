#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { renderEstimateReviewV1 } from './_render_estimate_review_lib.mjs';

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--raw') args.raw = argv[++i];
    else if (a === '--help') args.help = true;
  }
  return args;
};

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.json || !args.out) {
  console.error(
    'Usage:\n' +
      '  node tmp/orchestrator-v2/estimate/render_estimate_review.mjs --json <estimate_judgment.json> --out <review.md> [--raw <raw.md>]'
  );
  process.exit(2);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const ensureDir = (p) => fs.mkdirSync(path.dirname(p), { recursive: true });
const existsFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

const deriveSiblingRaw = (reviewOutPath) => {
  if (!reviewOutPath) return null;
  const candidate = path.join(path.dirname(reviewOutPath), 'estimate_raw.md');
  return existsFile(candidate) ? candidate : null;
};

const estimateJson = readJson(args.json);
const rawDocPath = args.raw || deriveSiblingRaw(args.out) || './tmp/orchestrator-v2/estimate/_baseline_estimate_raw.md';

const out = renderEstimateReviewV1({
  inputJsonPath: args.json,
  reviewDocPath: args.out,
  rawDocPath,
  estimateJson,
});

ensureDir(args.out);
fs.writeFileSync(args.out, out, 'utf8');


#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { renderLayer3ReviewV1 } from './_review_lib.mjs';

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

const src = readJson(args.json);
const rawDocPath = args.raw || './docs/reconciliation/lock/layer3/LAYER3_LEDGER_LOCK_JUDGMENT_RAW.md';
const evidencePath = args.evidence || './artifacts/tenants/vent-guys/runs/2026-04-09T03-54-25.639Z/observed_bundle/';

const out = renderLayer3ReviewV1({
  inputJsonPath: args.json,
  reviewDocPath: args.out,
  rawDocPath,
  preferredEvidenceBundlePath: evidencePath,
  observedJudgmentJson: src,
});

ensureDir(args.out);
fs.writeFileSync(args.out, out, 'utf8');

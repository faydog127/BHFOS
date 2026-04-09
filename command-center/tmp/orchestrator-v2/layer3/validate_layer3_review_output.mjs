#!/usr/bin/env node
import fs from 'node:fs';
import { normalizeNewlines, renderLayer3ReviewV1 } from './_review_lib.mjs';

const parseArgs = (argv) => {
  const args = { mode: 'exact' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') args.mode = argv[++i];
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--doc') args.doc = argv[++i];
    else if (a === '--help') args.help = true;
  }
  return args;
};

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.doc) {
  console.error(
    'Usage:\n' +
      '  node tmp/orchestrator-v2/layer3/validate_layer3_review_output.mjs --mode exact --json <layer2_observed_judgment.json> --doc <review.md>\n' +
      '  node tmp/orchestrator-v2/layer3/validate_layer3_review_output.mjs --mode structural --doc <review.md>'
  );
  process.exit(2);
}

const doc = normalizeNewlines(fs.readFileSync(args.doc, 'utf8'));

const requiredHeadings = [
  '# Ledger Lock — Review Summary',
  '## Inputs',
  '## Executive Summary',
  '## Snapshot',
  '## Proven Properties',
  '## Results (By Test)',
  '## Evidence Map',
  '## Open Risks',
  '## Raw Artifact Gaps',
  '## What This Does Not Prove',
  '## Next Best Action',
  '## Reproduce',
];

const idx = (h) => doc.indexOf(h);
for (const h of requiredHeadings) {
  if (idx(h) < 0) {
    console.error(`LAYER3 REVIEW VALIDATION: FAILED\n\nMissing heading: ${h}`);
    process.exit(1);
  }
}
for (let i = 1; i < requiredHeadings.length; i++) {
  if (idx(requiredHeadings[i]) <= idx(requiredHeadings[i - 1])) {
    console.error(
      'LAYER3 REVIEW VALIDATION: FAILED\n\nHeading order mismatch:\n' +
        `- expected: ${requiredHeadings[i - 1]} before ${requiredHeadings[i]}`
    );
    process.exit(1);
  }
}

if (args.mode === 'structural') {
  console.log('LAYER3 REVIEW VALIDATION: PASSED (structural)');
  process.exit(0);
}

if (args.mode !== 'exact' || !args.json) {
  console.error('LAYER3 REVIEW VALIDATION: FAILED\n\nInvalid mode or missing --json for exact mode.');
  process.exit(2);
}

const observedJudgmentJson = JSON.parse(fs.readFileSync(args.json, 'utf8'));
const expected = renderLayer3ReviewV1({
  inputJsonPath: args.json,
  reviewDocPath: args.doc,
  rawDocPath: './docs/reconciliation/lock/layer3/LAYER3_LEDGER_LOCK_JUDGMENT_RAW.md',
  preferredEvidenceBundlePath: './artifacts/tenants/vent-guys/runs/2026-04-09T03-54-25.639Z/observed_bundle/',
  observedJudgmentJson,
});

const normExpected = normalizeNewlines(expected).trimEnd() + '\n';
const normActual = normalizeNewlines(doc).trimEnd() + '\n';

if (normExpected !== normActual) {
  const expLines = normExpected.split('\n');
  const actLines = normActual.split('\n');
  const max = Math.max(expLines.length, actLines.length);
  let firstDiff = -1;
  for (let i = 0; i < max; i++) {
    if ((expLines[i] || '') !== (actLines[i] || '')) {
      firstDiff = i + 1;
      break;
    }
  }
  console.error('LAYER3 REVIEW VALIDATION: FAILED\n');
  if (firstDiff > 0) {
    console.error(`First difference at line ${firstDiff}:`);
    console.error(`- expected: ${(expLines[firstDiff - 1] || '').slice(0, 240)}`);
    console.error(`- actual:   ${(actLines[firstDiff - 1] || '').slice(0, 240)}`);
    console.error('');
  }
  console.error('Fix: re-render the review doc from the JSON input:');
  console.error(`- node tmp/orchestrator-v2/layer3/render_layer3_review.mjs --json ${args.json} --out ${args.doc}`);
  process.exit(1);
}

console.log('LAYER3 REVIEW VALIDATION: PASSED (exact)');

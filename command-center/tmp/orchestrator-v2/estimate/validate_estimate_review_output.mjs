#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { normalizeNewlines } from './_estimate_lib.mjs';
import { renderEstimateReviewV1 } from './_render_estimate_review_lib.mjs';

const parseArgs = (argv) => {
  const args = { mode: 'exact' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') args.mode = argv[++i];
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--doc') args.doc = argv[++i];
    else if (a === '--raw') args.raw = argv[++i];
    else if (a === '--help') args.help = true;
  }
  return args;
};

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.doc) {
  console.error(
    'Usage:\n' +
      '  node tmp/orchestrator-v2/estimate/validate_estimate_review_output.mjs --mode exact --json <estimate_judgment.json> --doc <estimate_review.md> [--raw <estimate_raw.md>]\n' +
      '  node tmp/orchestrator-v2/estimate/validate_estimate_review_output.mjs --mode structural --doc <estimate_review.md>'
  );
  process.exit(2);
}

const doc = normalizeNewlines(fs.readFileSync(args.doc, 'utf8'));

const requiredHeadings = [
  '# Estimate — Review Summary',
  '## Inputs',
  '## Snapshot',
  '## Situation',
  '## Recommendation',
  '## Options',
  '## Selected Scope (What You Are Approving)',
  '## Investment',
  '## Scope Boundaries (How to Read This)',
  '## Not Included (Universal)',
  '## Included / Not Included (Selected Option)',
  '## Approval Terms',
  '## Evidence',
  '## Re-render',
];

const idx = (h) => doc.indexOf(h);
for (const h of requiredHeadings) {
  if (idx(h) < 0) {
    console.error(`ESTIMATE REVIEW VALIDATION: FAILED\n\nMissing heading: ${h}`);
    process.exit(1);
  }
}
for (let i = 1; i < requiredHeadings.length; i++) {
  if (idx(requiredHeadings[i]) <= idx(requiredHeadings[i - 1])) {
    console.error(
      'ESTIMATE REVIEW VALIDATION: FAILED\n\nHeading order mismatch:\n' +
        `- expected: ${requiredHeadings[i - 1]} before ${requiredHeadings[i]}`
    );
    process.exit(1);
  }
}

if (args.mode === 'structural') {
  console.log('ESTIMATE REVIEW VALIDATION: PASSED (structural)');
  process.exit(0);
}

if (args.mode !== 'exact' || !args.json) {
  console.error('ESTIMATE REVIEW VALIDATION: FAILED\n\nInvalid mode or missing --json for exact mode.');
  process.exit(2);
}

const deriveSiblingRaw = (reviewDocPath) => {
  if (!reviewDocPath) return null;
  const candidate = path.join(path.dirname(reviewDocPath), 'estimate_raw.md');
  return fs.existsSync(candidate) ? candidate : null;
};

const rawDocPath = args.raw || deriveSiblingRaw(args.doc) || './tmp/orchestrator-v2/estimate/_baseline_estimate_raw.md';

const estimateJson = JSON.parse(fs.readFileSync(args.json, 'utf8'));
const expected = renderEstimateReviewV1({
  inputJsonPath: args.json,
  reviewDocPath: args.doc,
  rawDocPath,
  estimateJson,
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
  console.error('ESTIMATE REVIEW VALIDATION: FAILED\n');
  if (firstDiff > 0) {
    console.error(`First difference at line ${firstDiff}:`);
    console.error(`- expected: ${(expLines[firstDiff - 1] || '').slice(0, 240)}`);
    console.error(`- actual:   ${(actLines[firstDiff - 1] || '').slice(0, 240)}`);
    console.error('');
  }
  console.error('Fix: re-render the review doc from the JSON input:');
  const rawHint = args.raw ? ` --raw ${args.raw}` : '';
  console.error(`- node tmp/orchestrator-v2/estimate/render_estimate_review.mjs --json ${args.json} --out ${args.doc}${rawHint}`);
  process.exit(1);
}

console.log('ESTIMATE REVIEW VALIDATION: PASSED (exact)');


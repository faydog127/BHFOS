#!/usr/bin/env node
import fs from 'node:fs';
import { normalizeNewlines } from './_estimate_lib.mjs';
import { renderEstimateRawV1 } from './_render_estimate_raw_lib.mjs';

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
if (args.help || !args.doc || (args.mode === 'exact' && !args.json)) {
  console.error(
    'Usage:\n' +
      '  node tmp/orchestrator-v2/estimate/validate_estimate_raw_output.mjs --mode exact --json <estimate_judgment.json> --doc <estimate_raw.md>\n' +
      '  node tmp/orchestrator-v2/estimate/validate_estimate_raw_output.mjs --mode structural --doc <estimate_raw.md>'
  );
  process.exit(2);
}

const docText = normalizeNewlines(fs.readFileSync(args.doc, 'utf8'));

const requiredHeadings = [
  '# Estimate v1 (Raw) — Judgment Contract',
  '## Snapshot',
  '## Evidence Refs',
  '## Situation Summary',
  '## Risk & Impact',
  '## Recommendation',
  '## Options',
  '## Universal Boundaries — Not Included',
  '## Approval Terms',
];

const idx = (h) => docText.indexOf(h);
for (const h of requiredHeadings) {
  if (idx(h) < 0) {
    console.error(`ESTIMATE RAW VALIDATION: FAILED\n\nMissing heading: ${h}`);
    process.exit(1);
  }
}
for (let i = 1; i < requiredHeadings.length; i++) {
  if (idx(requiredHeadings[i]) <= idx(requiredHeadings[i - 1])) {
    console.error(
      'ESTIMATE RAW VALIDATION: FAILED\n\nHeading order mismatch:\n' +
        `- expected: ${requiredHeadings[i - 1]} before ${requiredHeadings[i]}`
    );
    process.exit(1);
  }
}

if (args.mode === 'structural') {
  console.log('ESTIMATE RAW VALIDATION: PASSED (structural)');
  process.exit(0);
}

const estimateJson = JSON.parse(fs.readFileSync(args.json, 'utf8'));
const expected = renderEstimateRawV1({ inputJsonPath: args.json, estimateJson });
const normExpected = normalizeNewlines(expected).trimEnd() + '\n';
const normActual = normalizeNewlines(docText).trimEnd() + '\n';

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
  console.error('ESTIMATE RAW VALIDATION: FAILED\n');
  if (firstDiff > 0) {
    console.error(`First difference at line ${firstDiff}:`);
    console.error(`- expected: ${(expLines[firstDiff - 1] || '').slice(0, 240)}`);
    console.error(`- actual:   ${(actLines[firstDiff - 1] || '').slice(0, 240)}`);
    console.error('');
  }
  console.error('Fix: re-render the doc from the JSON input:');
  console.error(`- node tmp/orchestrator-v2/estimate/render_estimate_raw.mjs ${args.json} ${args.doc}`);
  process.exit(1);
}

console.log('ESTIMATE RAW VALIDATION: PASSED (exact)');


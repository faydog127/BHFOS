#!/usr/bin/env node
import fs from 'node:fs';

const parseArgs = (argv) => {
  const args = { mode: 'structural' };
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
      '  node tmp/orchestrator-v2/layer3/validate_layer3_review_output.mjs --mode structural --doc <review.md>\n' +
      '  node tmp/orchestrator-v2/layer3/validate_layer3_review_output.mjs --mode token --json <layer2_observed_judgment.json> --doc <review.md>'
  );
  process.exit(2);
}

const normalize = (t) => String(t || '').replace(/\r\n/g, '\n');
const doc = normalize(fs.readFileSync(args.doc, 'utf8'));

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

if (args.mode !== 'token' || !args.json) {
  console.error('LAYER3 REVIEW VALIDATION: FAILED\n\nInvalid mode or missing --json for token mode.');
  process.exit(2);
}

const src = JSON.parse(fs.readFileSync(args.json, 'utf8'));
const judgment = src?.judgment || {};

const mustContain = [
  `- run_id: \`${src.run_id}\``,
  `- verdict: \`${judgment.test_run_verdict}\``,
  `- next_action_type: \`${judgment.next_action_type}\``,
];

for (const s of mustContain) {
  if (!doc.includes(s)) {
    console.error(`LAYER3 REVIEW VALIDATION: FAILED\n\nMissing required token line:\n${s}`);
    process.exit(1);
  }
}

// Must explicitly reference raw-contract SSOT to prevent “review doc becomes truth”.
if (!doc.toLowerCase().includes('ssot')) {
  console.error('LAYER3 REVIEW VALIDATION: FAILED\n\nMissing SSOT statement (must explicitly defer to raw contract + JSON).');
  process.exit(1);
}

console.log('LAYER3 REVIEW VALIDATION: PASSED (token)');


#!/usr/bin/env node
import fs from 'node:fs';
import { normalizeNewlines, renderLayer3Raw } from './_render_lib.mjs';

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
      '  node tmp/orchestrator-v2/layer3/validate_layer3_output.mjs --mode exact --json <layer2_observed_judgment.json> --doc <layer3.md>\n' +
      '  node tmp/orchestrator-v2/layer3/validate_layer3_output.mjs --mode structural --doc <layer3.md>'
  );
  process.exit(2);
}

const docText = normalizeNewlines(fs.readFileSync(args.doc, 'utf8'));

const requiredHeadings = [
  '# Layer 3 (Raw) — Ledger Lock Judgment',
  '## Snapshot',
  '## Proven property status',
  '## Result by test',
  '## Run summary',
  '## Deployment risks still open',
  '## Next best action',
  '## Raw artifact gaps',
];

const idx = (h) => docText.indexOf(h);
for (const h of requiredHeadings) {
  if (idx(h) < 0) {
    console.error(`LAYER3 VALIDATION: FAILED\n\nMissing heading: ${h}`);
    process.exit(1);
  }
}
for (let i = 1; i < requiredHeadings.length; i++) {
  if (idx(requiredHeadings[i]) <= idx(requiredHeadings[i - 1])) {
    console.error(
      'LAYER3 VALIDATION: FAILED\n\nHeading order mismatch:\n' +
        `- expected: ${requiredHeadings[i - 1]} before ${requiredHeadings[i]}`
    );
    process.exit(1);
  }
}

if (args.mode === 'structural') {
  console.log('LAYER3 VALIDATION: PASSED (structural)');
  process.exit(0);
}

const observedJudgmentJson = JSON.parse(fs.readFileSync(args.json, 'utf8'));
const expected = renderLayer3Raw({ inputPath: args.json, observedJudgmentJson });
const actual = docText;

const normExpected = normalizeNewlines(expected).trimEnd() + '\n';
const normActual = normalizeNewlines(actual).trimEnd() + '\n';

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
  console.error('LAYER3 VALIDATION: FAILED\n');
  if (firstDiff > 0) {
    console.error(`First difference at line ${firstDiff}:`);
    console.error(`- expected: ${(expLines[firstDiff - 1] || '').slice(0, 240)}`);
    console.error(`- actual:   ${(actLines[firstDiff - 1] || '').slice(0, 240)}`);
    console.error('');
  }
  console.error('Fix: re-render the doc from the JSON input:');
  console.error(`- node tmp/orchestrator-v2/layer3/render_layer3_raw.mjs ${args.json} ${args.doc}`);
  process.exit(1);
}

// Token validity checks (defense-in-depth)
const allowedVerdicts = new Set(['DEPLOY BLOCKED', 'DEPLOY CAUTION', 'DEPLOY CONFIDENCE INCREASED', 'DEPLOY_BLOCKED', 'DEPLOY_CAUTION', 'DEPLOY_CONFIDENCE_INCREASED']);
const allowedNextActionTypes = new Set(['code_fix', 'harness_fix', 'environment_fix', 'confidence_rerun']);

const verdictMatch = normActual.match(/^- verdict:\s+`([^`]+)`/m);
if (verdictMatch && !allowedVerdicts.has(verdictMatch[1])) {
  console.error(`LAYER3 VALIDATION: FAILED\n\nInvalid verdict token: ${verdictMatch[1]}`);
  process.exit(1);
}

const nextActionMatch = normActual.match(/^- next_action_type:\s+`([^`]+)`/m);
if (nextActionMatch && !allowedNextActionTypes.has(nextActionMatch[1])) {
  console.error(`LAYER3 VALIDATION: FAILED\n\nInvalid next_action_type token: ${nextActionMatch[1]}`);
  process.exit(1);
}

console.log('LAYER3 VALIDATION: PASSED (exact)');


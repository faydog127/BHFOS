import fs from 'node:fs';

function usage() {
  console.error('Usage: node tmp/orchestrator-v2/eval/validate_judgment.mjs <judgmentMdPath>');
  process.exit(2);
}

const p = process.argv[2];
if (!p) usage();

const text = fs.readFileSync(p, 'utf8');
const required = [
  /^TEST RUN VERDICT:/m,
  /^SCOPE:/m,
  /^RUN SUMMARY:/m,
  /^RESULT BY TEST:/m,
  /^PROVEN PROPERTY STATUS:/m,
  /^CONFIDENCE CHANGE:/m,
  /^DEPLOYMENT RISKS STILL OPEN:/m,
  /^NEXT ACTION TYPE:/m,
  /^NEXT BEST ACTION:/m,
  /^RAW ARTIFACT GAPS:/m,
];

let lastIndex = -1;
for (const r of required) {
  const m = text.match(r);
  if (!m) throw new Error(`Missing required section header: ${r}`);
  const idx = m.index ?? -1;
  if (idx <= lastIndex) throw new Error(`Section headers out of order at: ${r}`);
  lastIndex = idx;
}

// Token checks
if (!text.match(/TEST RUN VERDICT:\s*`(DEPLOY_BLOCKED|DEPLOY_CAUTION|DEPLOY_CONFIDENCE_INCREASED)`/)) {
  throw new Error('Verdict token missing/invalid.');
}
if (!text.match(/NEXT ACTION TYPE:\s*`(code_fix|harness_fix|environment_fix|confidence_rerun)`/)) {
  throw new Error('Next action type token missing/invalid.');
}
if (!text.match(/^CONFIDENCE CHANGE:\s*(unavailable_no_prior_run|available_via_prior_run_artifact)$/m)) {
  throw new Error('Confidence change line missing/invalid.');
}

console.log('OK');


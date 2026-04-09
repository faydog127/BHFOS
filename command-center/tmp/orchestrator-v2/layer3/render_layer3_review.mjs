#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

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
const normPath = (p) => String(p || '').replaceAll('\\', '/');
const mdInline = (s) => `\`${String(s)}\``;

const src = readJson(args.json);
const judgment = src?.judgment || {};

const rawDocPath = args.raw || './docs/reconciliation/lock/layer3/LAYER3_LEDGER_LOCK_JUDGMENT_RAW.md';
const evidencePath =
  args.evidence || './artifacts/runs/2026-04-09T03-54-25.639Z/observed_bundle/';

const verdict = judgment.test_run_verdict || 'UNKNOWN';
const nextActionType = judgment.next_action_type || 'UNKNOWN';
const confidenceChange = judgment.confidence_change || 'UNKNOWN';
const failureMechanism = judgment.failure_mechanism ?? null;
const runId = src.run_id || 'UNKNOWN';

const proven = judgment.proven_property_status && typeof judgment.proven_property_status === 'object'
  ? judgment.proven_property_status
  : {};
const provenKeys = Object.keys(proven).sort();

const results = Array.isArray(judgment.result_by_test) ? judgment.result_by_test : [];
const risks = Array.isArray(judgment.deployment_risks_still_open) ? judgment.deployment_risks_still_open : [];
const gaps = Array.isArray(judgment.raw_artifact_gaps) ? judgment.raw_artifact_gaps : [];

const lines = [];
lines.push('# Ledger Lock — Review Summary');
lines.push('');
lines.push('Contract: `layer3_review_v1`');
lines.push('Audience: internal review (human-optimized)');
lines.push('SSOT: Layer 3 raw contract doc + Layer 2 judgment JSON (no extra interpretation).');
lines.push('');
lines.push('## Inputs');
lines.push(`- Layer 2 judgment JSON: ${mdInline(normPath(args.json))}`);
lines.push(`- Layer 3 raw contract doc: ${mdInline(normPath(rawDocPath))}`);
lines.push(`- Preferred evidence bundle (committed copy): ${mdInline(normPath(evidencePath))}`);
lines.push('');
lines.push('## Executive Summary');
lines.push(
  `Layer 2 classified this run as ${mdInline(verdict)} with next action type ${mdInline(nextActionType)} and confidence change ${mdInline(
    confidenceChange
  )}.`
);
lines.push('');
lines.push('## Snapshot');
lines.push(`- run_id: ${mdInline(runId)}`);
lines.push(`- verdict: ${mdInline(verdict)}`);
lines.push(`- next_action_type: ${mdInline(nextActionType)}`);
lines.push(`- failure_mechanism: ${mdInline(failureMechanism)}`);
lines.push('');
lines.push('## Proven Properties');
for (const k of provenKeys) lines.push(`- ${k}: ${mdInline(proven[k])}`);
if (!provenKeys.length) lines.push('- (none)');
lines.push('');
lines.push('## Results (By Test)');
for (const r of results) lines.push(`- ${r.test_id}: ${mdInline(r.status)} (${r.result_path})`);
if (!results.length) lines.push('- (none)');
lines.push('');
lines.push('## Evidence Map');
lines.push(`- Raw contract (exact): ${mdInline(normPath(rawDocPath))}`);
lines.push(`- Evidence bundle root: ${mdInline(normPath(evidencePath))}`);
lines.push(`- Judgment JSON: ${mdInline(normPath(args.json))}`);
lines.push('');
lines.push('## Open Risks');
for (const r of risks) lines.push(`- ${String(r)}`);
if (!risks.length) lines.push('- (none)');
lines.push('');
lines.push('## Raw Artifact Gaps');
for (const g of gaps) lines.push(`- ${String(g)}`);
if (!gaps.length) lines.push('- (none)');
lines.push('');
lines.push('## What This Does Not Prove');
lines.push('- Production validation (unless separately evidenced and labeled).');
lines.push('- Future correctness under changed schema/services without revalidation.');
lines.push('');
lines.push('## Next Best Action');
lines.push(judgment.next_best_action || '(missing)');
lines.push('');
lines.push('## Reproduce');
lines.push('- Run Layer 1 deck: `pwsh -NoProfile -File ./tmp/billing-ledger-php/tests/run.ps1`');
lines.push('- Run Layer 2 evaluation: `pwsh -NoProfile -File ./tmp/orchestrator-v2/runner/ci_layer2_eval.ps1`');
lines.push(
  `- Re-render docs: \`node tmp/orchestrator-v2/layer3/render_layer3_raw.mjs ${normPath(args.json)} ${normPath(
    rawDocPath
  )}\` + \`node tmp/orchestrator-v2/layer3/render_layer3_review.mjs --json ${normPath(args.json)} --out ${normPath(args.out)}\``
);
lines.push('');

ensureDir(args.out);
fs.writeFileSync(args.out, lines.join('\n') + '\n', 'utf8');


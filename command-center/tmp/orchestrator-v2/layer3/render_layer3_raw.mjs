#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error('Usage: node tmp/orchestrator-v2/layer3/render_layer3_raw.mjs <layer2_observed_judgment.json> <out.md>');
  process.exit(2);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const ensureDir = (p) => fs.mkdirSync(path.dirname(p), { recursive: true });

const src = readJson(inputPath);
const judgment = src?.judgment || {};

const lines = [];
lines.push('# Layer 3 (Raw) — Ledger Lock Judgment');
lines.push('');
lines.push(`Input: \`${inputPath.replaceAll('\\', '/')}\``);
lines.push('');
lines.push('## Snapshot');
lines.push(`- run_id: \`${src.run_id || 'UNKNOWN'}\``);
lines.push(`- verdict: \`${judgment.test_run_verdict || 'UNKNOWN'}\``);
lines.push(`- next_action_type: \`${judgment.next_action_type || 'UNKNOWN'}\``);
lines.push(`- confidence_change: \`${judgment.confidence_change || 'UNKNOWN'}\``);
lines.push('');
lines.push('## Proven property status');
const props = judgment.proven_property_status || {};
for (const k of Object.keys(props).sort()) {
  lines.push(`- ${k}: \`${props[k]}\``);
}
if (!Object.keys(props).length) lines.push('- (none)');
lines.push('');
lines.push('## Result by test');
const rbt = Array.isArray(judgment.result_by_test) ? judgment.result_by_test : [];
for (const r of rbt) {
  lines.push(`- ${r.test_id || 'UNKNOWN'}: \`${r.status || 'UNKNOWN'}\` (${r.result_path || 'n/a'})`);
}
if (!rbt.length) lines.push('- (none)');
lines.push('');
lines.push('## Run summary');
if (judgment.run_summary_line) lines.push(`- ${judgment.run_summary_line}`);
if (judgment.scope) lines.push(`- scope: ${judgment.scope}`);
lines.push('');
lines.push('## Deployment risks still open');
const risks = Array.isArray(judgment.deployment_risks_still_open) ? judgment.deployment_risks_still_open : [];
for (const r of risks) lines.push(`- ${r}`);
if (!risks.length) lines.push('- (none)');
lines.push('');
lines.push('## Next best action');
lines.push(judgment.next_best_action || '(missing)');
lines.push('');
lines.push('## Raw artifact gaps');
const gaps = Array.isArray(judgment.raw_artifact_gaps) ? judgment.raw_artifact_gaps : [];
for (const g of gaps) lines.push(`- ${g}`);
if (!gaps.length) lines.push('- (none)');
lines.push('');

ensureDir(outputPath);
fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');


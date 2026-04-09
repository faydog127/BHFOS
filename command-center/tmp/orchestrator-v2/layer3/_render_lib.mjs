export const normalizeNewlines = (text) => String(text || '').replace(/\r\n/g, '\n');

const asString = (value) => {
  if (value === undefined) return 'UNKNOWN';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const mdInline = (value) => `\`${asString(value)}\``;

export const renderLayer3Raw = ({ inputPath, observedJudgmentJson }) => {
  const src = observedJudgmentJson || {};
  const judgment = src?.judgment || {};

  const lines = [];
  lines.push('# Layer 3 (Raw) — Ledger Lock Judgment');
  lines.push('');
  lines.push('Contract: `layer3_raw_v1`');
  lines.push('');
  lines.push(`Input: \`${String(inputPath || '').replaceAll('\\', '/')}\``);
  lines.push('');
  lines.push('## Snapshot');
  lines.push(`- run_id: ${mdInline(src.run_id)}`);
  lines.push(`- observed_bundle_root: ${mdInline(src.observed_bundle_root)}`);
  if ('source_observed_bundle_root' in src) {
    lines.push(`- source_observed_bundle_root: ${mdInline(src.source_observed_bundle_root)}`);
  }
  lines.push(`- verdict: ${mdInline(judgment.test_run_verdict)}`);
  lines.push(`- next_action_type: ${mdInline(judgment.next_action_type)}`);
  lines.push(`- failure_mechanism: ${mdInline(judgment.failure_mechanism)}`);
  lines.push(`- confidence_change: ${mdInline(judgment.confidence_change)}`);
  lines.push('');

  lines.push('## Proven property status');
  const props = judgment.proven_property_status && typeof judgment.proven_property_status === 'object'
    ? judgment.proven_property_status
    : {};
  const propKeys = Object.keys(props).sort();
  for (const k of propKeys) lines.push(`- ${k}: ${mdInline(props[k])}`);
  if (!propKeys.length) lines.push('- (none)');
  lines.push('');

  lines.push('## Result by test');
  const rbt = Array.isArray(judgment.result_by_test) ? judgment.result_by_test : [];
  for (const r of rbt) {
    lines.push(`- ${asString(r.test_id)}: ${mdInline(r.status)} (${asString(r.result_path)})`);
  }
  if (!rbt.length) lines.push('- (none)');
  lines.push('');

  lines.push('## Run summary');
  lines.push(`- run_summary_line: ${mdInline(judgment.run_summary_line)}`);
  lines.push(`- scope: ${mdInline(judgment.scope)}`);
  lines.push('');

  lines.push('## Deployment risks still open');
  const risks = Array.isArray(judgment.deployment_risks_still_open) ? judgment.deployment_risks_still_open : [];
  for (const r of risks) lines.push(`- ${asString(r)}`);
  if (!risks.length) lines.push('- (none)');
  lines.push('');

  lines.push('## Next best action');
  lines.push(asString(judgment.next_best_action));
  lines.push('');

  lines.push('## Raw artifact gaps');
  const gaps = Array.isArray(judgment.raw_artifact_gaps) ? judgment.raw_artifact_gaps : [];
  for (const g of gaps) lines.push(`- ${asString(g)}`);
  if (!gaps.length) lines.push('- (none)');
  lines.push('');

  return normalizeNewlines(lines.join('\n') + '\n');
};


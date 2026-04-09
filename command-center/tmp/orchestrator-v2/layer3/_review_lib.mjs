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
const normPath = (p) => asString(p).replaceAll('\\', '/');

export const renderLayer3ReviewV1 = ({
  inputJsonPath,
  reviewDocPath,
  rawDocPath,
  preferredEvidenceBundlePath,
  observedJudgmentJson,
}) => {
  const src = observedJudgmentJson || {};
  const judgment = src?.judgment || {};

  const verdict = judgment.test_run_verdict;
  const nextActionType = judgment.next_action_type;
  const confidenceChange = judgment.confidence_change;
  const failureMechanism = judgment.failure_mechanism;
  const runId = src.run_id;

  const proven =
    judgment.proven_property_status && typeof judgment.proven_property_status === 'object'
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
  lines.push(`- Layer 2 judgment JSON: ${mdInline(normPath(inputJsonPath))}`);
  lines.push(`- Layer 3 raw contract doc: ${mdInline(normPath(rawDocPath))}`);
  lines.push(`- Preferred evidence bundle (committed copy): ${mdInline(normPath(preferredEvidenceBundlePath))}`);
  lines.push('');

  lines.push('## Executive Summary');
  lines.push(
    `Layer 2 classified this run as ${mdInline(verdict)} with next action type ${mdInline(
      nextActionType
    )} and confidence change ${mdInline(confidenceChange)}.`
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
  for (const r of results) lines.push(`- ${asString(r.test_id)}: ${mdInline(r.status)} (${asString(r.result_path)})`);
  if (!results.length) lines.push('- (none)');
  lines.push('');

  lines.push('## Evidence Map');
  lines.push(`- Raw contract (exact): ${mdInline(normPath(rawDocPath))}`);
  lines.push(`- Evidence bundle root: ${mdInline(normPath(preferredEvidenceBundlePath))}`);
  lines.push(`- Judgment JSON: ${mdInline(normPath(inputJsonPath))}`);
  lines.push('');

  lines.push('## Open Risks');
  for (const r of risks) lines.push(`- ${asString(r)}`);
  if (!risks.length) lines.push('- (none)');
  lines.push('');

  lines.push('## Raw Artifact Gaps');
  for (const g of gaps) lines.push(`- ${asString(g)}`);
  if (!gaps.length) lines.push('- (none)');
  lines.push('');

  lines.push('## What This Does Not Prove');
  lines.push('- Production validation (unless separately evidenced and labeled).');
  lines.push('- Future correctness under changed schema/services without revalidation.');
  lines.push('');

  lines.push('## Next Best Action');
  lines.push(asString(judgment.next_best_action));
  lines.push('');

  lines.push('## Reproduce');
  lines.push('- Run Layer 1 deck: `pwsh -NoProfile -File ./tmp/billing-ledger-php/tests/run.ps1`');
  lines.push('- Run Layer 2 evaluation: `pwsh -NoProfile -File ./tmp/orchestrator-v2/runner/ci_layer2_eval.ps1`');
  lines.push(
    `- Re-render docs: \`node tmp/orchestrator-v2/layer3/render_layer3_raw.mjs ${normPath(
      inputJsonPath
    )} ${normPath(rawDocPath)}\` + \`node tmp/orchestrator-v2/layer3/render_layer3_review.mjs --json ${normPath(
      inputJsonPath
    )} --out ${normPath(reviewDocPath)}\``
  );
  lines.push('');

  return normalizeNewlines(lines.join('\n') + '\n');
};

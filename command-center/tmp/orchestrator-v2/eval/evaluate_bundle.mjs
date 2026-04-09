import fs from 'node:fs';
import path from 'node:path';

import {
  readJson,
  writeJson,
  writeText,
  loadSchemas,
  validateOne,
  hasCorrectnessInvariantFailure,
  listMissingArtifacts,
} from './_lib.mjs';

function usage() {
  console.error('Usage: node tmp/orchestrator-v2/eval/evaluate_bundle.mjs <bundleDir> <outDir>');
  process.exit(2);
}

function loadResults(bundleDir, runSummary) {
  const results = [];
  for (const r of runSummary.test_index.results) {
    const p = path.join(bundleDir, r.result_path);
    if (!fs.existsSync(p)) continue;
    results.push(readJson(p));
  }
  return results;
}

function classifyFailureMechanism(results) {
  const classifications = results.map((r) => r.classification).filter(Boolean);
  if (classifications.length === 0) return null;

  // Prefer most severe-like: concurrency > business > migration > harness > environment.
  const priority = [
    'concurrency_defect',
    'business_logic_defect',
    'migration_defect',
    'test_harness_defect',
    'environment_config_defect',
  ];
  for (const p of priority) {
    if (classifications.includes(p)) return p;
  }
  return classifications[0] ?? null;
}

function computeNextActionType({ verdict, mechanism }) {
  if (verdict === 'DEPLOY_CONFIDENCE_INCREASED') return 'confidence_rerun';
  if (mechanism === 'environment_config_defect') return 'environment_fix';
  if (mechanism === 'test_harness_defect') return 'harness_fix';
  if (mechanism === 'migration_defect') return 'code_fix';
  if (mechanism === 'concurrency_defect') return 'code_fix';
  if (mechanism === 'business_logic_defect') return 'code_fix';
  return 'confidence_rerun';
}

function computeVerdict({ runSummary, soakSummary, results }) {
  // Per decision rules: treat orchestrator-produced artifact_completeness as authoritative when present.
  const artifactsComplete =
    !!runSummary.artifact_completeness &&
    runSummary.artifact_completeness.worker_stdout &&
    runSummary.artifact_completeness.worker_stderr &&
    runSummary.artifact_completeness.db_snapshot &&
    runSummary.artifact_completeness.timing_trace;

  if (!artifactsComplete) {
    return 'DEPLOY_CAUTION';
  }

  if (hasCorrectnessInvariantFailure(results)) {
    return 'DEPLOY_BLOCKED';
  }

  if (soakSummary && soakSummary.fail_count > 0) {
    return 'DEPLOY_BLOCKED';
  }

  if (soakSummary && soakSummary.failure_mode === 'intermittent') {
    return 'DEPLOY_BLOCKED';
  }

  if (runSummary.promotion_gate?.deploy_recommended === true) {
    return 'DEPLOY_CONFIDENCE_INCREASED';
  }

  // Race lane without soak: max caution.
  if (runSummary.lane === 'race' && runSummary.promotion_gate?.deploy_recommended === false) {
    const reason = String(runSummary.promotion_gate?.reason ?? '').toLowerCase();
    if (reason.includes('soak') || (runSummary.open_risks ?? []).some((x) => String(x).toLowerCase().includes('soak'))) {
      return 'DEPLOY_CAUTION';
    }
  }

  return 'DEPLOY_CAUTION';
}

function buildMarkdown(judgment) {
  const lines = [];
  lines.push(`TEST RUN VERDICT: \`${judgment.test_run_verdict}\``);
  lines.push(`SCOPE: ${judgment.scope}`);
  lines.push(`RUN SUMMARY: ${judgment.run_summary_line}`);
  lines.push('RESULT BY TEST:');
  for (const r of judgment.result_by_test) {
    lines.push(`- ${r.test_id}: ${r.status}`);
  }
  lines.push('PROVEN PROPERTY STATUS:');
  for (const [k, v] of Object.entries(judgment.proven_property_status ?? {})) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push(`CONFIDENCE CHANGE: ${judgment.confidence_change}`);
  lines.push('DEPLOYMENT RISKS STILL OPEN:');
  if ((judgment.deployment_risks_still_open ?? []).length === 0) lines.push('- (none)');
  else for (const r of judgment.deployment_risks_still_open) lines.push(`- ${r}`);
  lines.push(`NEXT ACTION TYPE: \`${judgment.next_action_type}\``);
  lines.push(`NEXT BEST ACTION: ${judgment.next_best_action}`);
  lines.push('RAW ARTIFACT GAPS:');
  if ((judgment.raw_artifact_gaps ?? []).length === 0) lines.push('- (none)');
  else for (const g of judgment.raw_artifact_gaps) lines.push(`- ${g}`);
  return lines.join('\n') + '\n';
}

function main() {
  const bundleDir = process.argv[2];
  const outDir = process.argv[3];
  if (!bundleDir || !outDir) usage();

  const repoRoot = process.cwd();
  const schemasRoot = path.join(repoRoot, 'tmp', 'orchestrator-v2');
  const { validateRunSummary, validateResult, validateSoak, validatePrior } = loadSchemas(schemasRoot);

  const runSummaryPath = path.join(bundleDir, 'run_summary.json');
  const runSummary = readJson(runSummaryPath);
  validateOne(validateRunSummary, runSummary, 'run_summary.json');

  const results = loadResults(bundleDir, runSummary);
  for (let i = 0; i < results.length; i++) validateOne(validateResult, results[i], `result[${i}]`);

  const soakPath = path.join(bundleDir, 'soak_summary.json');
  const soakSummary = fs.existsSync(soakPath) ? readJson(soakPath) : null;
  if (soakSummary) validateOne(validateSoak, soakSummary, 'soak_summary.json');

  const priorPath = path.join(bundleDir, 'prior_run_verdict.json');
  const prior = fs.existsSync(priorPath) ? readJson(priorPath) : null;
  if (prior) validateOne(validatePrior, prior, 'prior_run_verdict.json');

  const artifactRel = {
    // Only check existence when referenced by results artifacts.
    ...Object.fromEntries(
      results.flatMap((r) =>
        Object.entries(r.artifacts ?? {}).filter(([, v]) => typeof v === 'string' && v.length > 0)
      )
    ),
  };
  const missingArtifacts = listMissingArtifacts(bundleDir, artifactRel);

  const verdict = computeVerdict({ runSummary, soakSummary, results });
  const mechanism = verdict === 'DEPLOY_CONFIDENCE_INCREASED' ? null : classifyFailureMechanism(results);
  const nextActionType = computeNextActionType({ verdict, mechanism });

  const confidenceChange = prior ? 'available_via_prior_run_artifact' : 'unavailable_no_prior_run';

  const provenPropertyStatus = runSummary.proven_property_status ?? {};
  const openRisks = runSummary.open_risks ?? [];

  const resultByTest = runSummary.test_index.results.map((t) => ({
    test_id: t.test_id,
    status: t.status,
    result_path: t.result_path,
  }));

  const judgment = {
    test_run_verdict: verdict,
    scope: `bundle=${path.relative(repoRoot, bundleDir)} lane=${runSummary.lane}`,
    run_summary_line: `run_id=${runSummary.run_id} pass=${runSummary.pass_count} fail=${runSummary.fail_count} mode=${runSummary.failure_mode}`,
    result_by_test: resultByTest,
    proven_property_status: provenPropertyStatus,
    confidence_change: confidenceChange,
    deployment_risks_still_open: openRisks,
    next_action_type: nextActionType,
    next_best_action:
      verdict === 'DEPLOY_CONFIDENCE_INCREASED'
        ? 'Proceed to Layer 3 document generation using this judgment output.'
        : 'Resolve the blocking/caution condition and rerun the same evaluator.',
    raw_artifact_gaps: missingArtifacts,
    failure_mechanism: mechanism,
  };

  writeJson(path.join(outDir, 'judgment.json'), judgment);
  writeText(path.join(outDir, 'judgment.md'), buildMarkdown(judgment));
}

main();

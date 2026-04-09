import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const repoRoot = process.cwd();
const examplesRoot = path.join(repoRoot, 'tmp', 'orchestrator-v2', 'examples');
const schemasRoot = path.join(repoRoot, 'tmp', 'orchestrator-v2');

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listDirs(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function parseExpected(readmeText) {
  const verdictMatch = readmeText.match(/TEST RUN VERDICT:\s*`([^`]+)`/i);
  const nextMatch = readmeText.match(/NEXT ACTION TYPE:\s*`([^`]+)`/i);
  return {
    expectedVerdict: verdictMatch ? verdictMatch[1].trim() : null,
    expectedNextActionType: nextMatch ? nextMatch[1].trim() : null,
  };
}

function validateOne(validateFn, obj, label) {
  const ok = validateFn(obj);
  if (!ok) {
    const errors = (validateFn.errors ?? []).map((e) => `${e.instancePath || '(root)'} ${e.message}`).join('; ');
    throw new Error(`Schema validation failed for ${label}: ${errors}`);
  }
}

function loadResultFiles(exampleDir, runSummary) {
  const results = [];
  for (const r of runSummary.test_index.results) {
    const p = path.join(exampleDir, r.result_path);
    if (!fs.existsSync(p)) continue;
    results.push(readJson(p));
  }
  return results;
}

const NON_CORRECTNESS_INVARIANTS = new Set(['artifact_completeness']);

function hasCorrectnessInvariantFailure(results) {
  for (const r of results) {
    for (const inv of r.invariant_results ?? []) {
      if (!inv || inv.passed !== false) continue;
      if (NON_CORRECTNESS_INVARIANTS.has(inv.name)) continue;
      return true;
    }
  }
  return false;
}

function anyClassification(results, classifications) {
  return results.some((r) => classifications.includes(r.classification));
}

function computeVerdictAndNextAction({ runSummary, soakSummary, results }) {
  const ac = runSummary.artifact_completeness;
  const artifactsComplete = !!ac && ac.worker_stdout && ac.worker_stderr && ac.db_snapshot && ac.timing_trace;

  if (!artifactsComplete) {
    if (anyClassification(results, ['environment_config_defect'])) {
      return { verdict: 'DEPLOY_CAUTION', nextActionType: 'environment_fix', reason: 'env_or_artifacts_incomplete' };
    }
    if (anyClassification(results, ['test_harness_defect'])) {
      return { verdict: 'DEPLOY_CAUTION', nextActionType: 'harness_fix', reason: 'harness_or_artifacts_incomplete' };
    }
    return { verdict: 'DEPLOY_CAUTION', nextActionType: 'environment_fix', reason: 'artifacts_incomplete' };
  }

  // Highest severity: correctness invariant failure evidence (not artifact completeness).
  if (hasCorrectnessInvariantFailure(results)) {
    return { verdict: 'DEPLOY_BLOCKED', nextActionType: 'code_fix', reason: 'invariant_violation' };
  }

  // Soak failures: treat as deploy blocked when correctness failures exist.
  if (soakSummary && soakSummary.fail_count > 0) {
    return { verdict: 'DEPLOY_BLOCKED', nextActionType: 'code_fix', reason: 'soak_failures' };
  }

  // Race lane without soak: max caution.
  if (runSummary.lane === 'race' && runSummary.promotion_gate?.deploy_recommended === false) {
    const reason = String(runSummary.promotion_gate?.reason ?? '').toLowerCase();
    if (reason.includes('soak') || (runSummary.open_risks ?? []).some((x) => String(x).toLowerCase().includes('soak'))) {
      return { verdict: 'DEPLOY_CAUTION', nextActionType: 'confidence_rerun', reason: 'race_without_soak' };
    }
  }

  if (runSummary.promotion_gate?.deploy_recommended === true) {
    return { verdict: 'DEPLOY_CONFIDENCE_INCREASED', nextActionType: 'confidence_rerun', reason: 'deploy_recommended' };
  }

  // Default cautious stance if we don't have a clear deploy-green signal.
  return { verdict: 'DEPLOY_CAUTION', nextActionType: 'confidence_rerun', reason: 'default' };
}

function main() {
  const runSummarySchema = readJson(path.join(schemasRoot, 'run_summary_schema_v2.json'));
  const resultSchema = readJson(path.join(schemasRoot, 'result_schema_v2.json'));
  const soakSchema = readJson(path.join(schemasRoot, 'soak_summary_schema_v2.json'));

  const validateRunSummary = ajv.compile(runSummarySchema);
  const validateResult = ajv.compile(resultSchema);
  const validateSoak = ajv.compile(soakSchema);

  const exampleDirs = listDirs(examplesRoot);
  const rows = [];

  for (const d of exampleDirs) {
    const exampleDir = path.join(examplesRoot, d);
    const runSummaryPath = path.join(exampleDir, 'run_summary.json');
    const readmePath = path.join(exampleDir, 'README.md');

    const runSummary = readJson(runSummaryPath);
    validateOne(validateRunSummary, runSummary, `${d}/run_summary.json`);

    const results = loadResultFiles(exampleDir, runSummary);
    for (let i = 0; i < results.length; i++) {
      validateOne(validateResult, results[i], `${d}/result[${i}]`);
    }

    const soakPath = path.join(exampleDir, 'soak_summary.json');
    const soakSummary = fs.existsSync(soakPath) ? readJson(soakPath) : null;
    if (soakSummary) {
      validateOne(validateSoak, soakSummary, `${d}/soak_summary.json`);
    }

    const expected = parseExpected(readText(readmePath));
    const computed = computeVerdictAndNextAction({ runSummary, soakSummary, results });

    const verdictMatch = expected.expectedVerdict ? expected.expectedVerdict === computed.verdict : null;
    const nextMatch = expected.expectedNextActionType ? expected.expectedNextActionType === computed.nextActionType : null;

    rows.push({
      example: d,
      verdict_expected: expected.expectedVerdict,
      verdict_actual: computed.verdict,
      verdict_match: verdictMatch,
      next_expected: expected.expectedNextActionType,
      next_actual: computed.nextActionType,
      next_match: nextMatch,
      reason: computed.reason,
    });
  }

  const failed = rows.filter((r) => r.verdict_match === false || r.next_match === false);

  console.log('EXAMPLE VERIFICATION RESULTS');
  for (const r of rows) {
    console.log(
      `- ${r.example}: verdict ${r.verdict_actual} (${r.verdict_match === false ? 'MISMATCH' : 'ok'}), next ${r.next_actual} (${r.next_match === false ? 'MISMATCH' : 'ok'})`
    );
  }

  if (failed.length > 0) {
    console.log('\nMISMATCH DETAILS');
    for (const r of failed) {
      console.log(`- ${r.example}: expected verdict=${r.verdict_expected}, got=${r.verdict_actual}; expected next=${r.next_expected}, got=${r.next_actual}`);
    }
    process.exit(1);
  }

  console.log('\nALL EXAMPLES MATCHED EXPECTED VERDICT + NEXT ACTION');
}

main();

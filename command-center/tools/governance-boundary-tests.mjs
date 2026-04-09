#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const exec = (cmd, args, opts = {}) =>
  childProcess.execFileSync(cmd, args, { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8', ...opts });

const safeRunDirName = (iso) => String(iso).replaceAll(':', '-');
const nowIso = () => new Date().toISOString();
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, value) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n', 'utf8');
};
const writeText = (p, text) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, 'utf8');
};

const policyPath = path.resolve(repoRoot, 'review-policy.json');
const gatePath = path.resolve(repoRoot, 'tools/review-gate.mjs');
if (!fs.existsSync(policyPath)) throw new Error('Missing review-policy.json');
if (!fs.existsSync(gatePath)) throw new Error('Missing tools/review-gate.mjs');

const policy = readJson(policyPath);
const sha = exec('git', ['rev-parse', 'HEAD']).trim();

const canonicalScenarioCategories = Array.isArray(policy.required_scenario_categories_when_triggered)
  ? policy.required_scenario_categories_when_triggered
  : [];

const requiredArtifactTypes = Array.isArray(policy.required_artifact_types) ? policy.required_artifact_types : [];

const requiredTopFields = Array.isArray(policy.required_top_level_fields) ? policy.required_top_level_fields : [];

const pickSnippet = () => "const policyPath = process.argv[2] || 'review-policy.json';";

const createStandardArtifacts = ({ runId, runDirAbs }) => {
  const runDirRel = path.relative(repoRoot, runDirAbs).replaceAll('\\', '/');
  const artifacts = [];

  const mk = (relPath, content) => {
    const p = path.join(runDirAbs, relPath);
    writeText(p, content);
    return path.join(runDirRel, relPath).replaceAll('\\', '/');
  };

  const logPath = mk(
    'stdout.log',
    `run_id: ${runId}\n` +
      `timestamp: ${nowIso()}\n` +
      `change_id: CHANGE-BOUNDARY-TESTS\n` +
      `note: synthetic log for governance boundary tests\n`
  );

  const testResultPath = mk(
    'test_result.txt',
    `run_id: ${runId}\n` +
      `timestamp: ${nowIso()}\n` +
      `change_id: CHANGE-BOUNDARY-TESTS\n` +
      `result: PASS\n`
  );

  const dbOutputPath = mk(
    'db_output.txt',
    `run_id: ${runId}\n` +
      `timestamp: ${nowIso()}\n` +
      `change_id: CHANGE-BOUNDARY-TESTS\n` +
      `note: synthetic db output for governance boundary tests\n`
  );

  const manifestPathAbs = path.join(runDirAbs, 'manifest.json');
  const manifestRel = path.join(runDirRel, 'manifest.json').replaceAll('\\', '/');
  writeJson(manifestPathAbs, {
    run_id: runId,
    timestamp: nowIso(),
    change_id: 'CHANGE-BOUNDARY-TESTS',
    source_commit: sha,
    artifacts: [
      { type: 'log', path: logPath },
      { type: 'test_result', path: testResultPath },
      { type: 'db_output', path: dbOutputPath },
      { type: 'manifest', path: manifestRel },
    ],
  });

  // Required types in policy are authoritative; ensure each is present, but keep paths real and non-empty.
  const add = (type, obj) => artifacts.push({ type, ...obj });

  add('log', {
    label: 'Synthetic log',
    proof_of: 'Boundary test runner output',
    path: logPath,
  });

  add('test_result', {
    label: 'Synthetic test result',
    proof_of: 'Boundary test runner checks',
    path: testResultPath,
  });

  add('db_output', {
    label: 'Synthetic DB output',
    proof_of: 'Boundary test runner DB-output placeholder',
    path: dbOutputPath,
  });

  add('manifest', {
    label: 'Synthetic manifest',
    proof_of: 'Boundary test runner manifest',
    path: manifestRel,
  });

  add('code_reference', {
    label: 'Gate snippet reference',
    proof_of: 'code_reference snippet matching enforcement file',
    path: 'tools/review-gate.mjs',
    snippet: pickSnippet(),
  });

  // Ensure we include every required artifact type at least once.
  for (const t of requiredArtifactTypes) {
    if (!artifacts.some((a) => a.type === t)) {
      // Most types are covered above; if a new type is added later, default to a log-like file.
      const p = mk(`${t}.txt`, `run_id: ${runId}\ntimestamp: ${nowIso()}\nchange_id: CHANGE-BOUNDARY-TESTS\n`);
      add(t, { label: `Synthetic ${t}`, proof_of: 'Boundary test synthetic artifact', path: p });
    }
  }

  return artifacts;
};

const makeBaseSubmission = ({ runId, generatedAt, changeId, title }) => {
  const filesChanged = [
    'docs/governance/REVIEW_MAP.md',
    'docs/templates/review-input.template.json',
    'review-policy.json',
    'tools/review-gate.mjs',
  ].filter((p) => fs.existsSync(path.resolve(repoRoot, p)));

  return {
    gate_version: 'v1',
    change_id: changeId,
    pr_id: 'LOCAL',
    title,
    generated_at: generatedAt,
    source_commit: sha,
    run_id: runId,
    files_changed: filesChanged.length ? filesChanged : ['tools/review-gate.mjs'],
    scope: { included: filesChanged.length ? filesChanged : ['tools/review-gate.mjs'], excluded: [] },
    domain_tags: ['money_state'],
    summary: 'Governance boundary test submission (synthetic).',
    decider: { name: 'UNASSIGNED', role: 'human_decider', approved_at: generatedAt },
    risk_acceptances: [],
    scenarios: canonicalScenarioCategories.map((cat) => ({
      category: cat,
      scenario: `Boundary scenario: ${cat}`,
      expected_behavior: 'Gate should enforce structural requirements for scenarios/artifacts.',
      verification_method: 'Run review:gate.',
      evidence_required: ['tools/review-gate.mjs'],
    })),
    concurrency_model: { model: 'dedupe_based', guarantees: ['No double financial effect'], non_guarantees: ['Duplicate attempts may occur'] },
    ops_impact: { alert_dedupe_identity: 'boundary-test', max_open_alerts_per_entity: '1', task_dedupe_rule: 'dedupe' },
    trigger_evidence: { derived_domain_tags: ['money_state'], derivation_inputs: ['synthetic boundary test'] },
    artifacts: [],
    coverage_report: {
      files_analyzed: filesChanged.length ? filesChanged : ['tools/review-gate.mjs'],
      discovery_inputs: ['tools/governance-boundary-tests.mjs'],
      excluded_scope: [],
      uncertainty_boundaries: ['Synthetic submission; focuses on structural enforcement only.'],
    },
    findings: [
      {
        id: 'F-INFO-BOUNDARY',
        title: 'Boundary test (synthetic)',
        severity: 'INFO',
        business_impact: 'Validates gate boundary behavior.',
        rule_violated: 'None (test)',
        proof: ['tools/governance-boundary-tests.mjs'],
        recommended_action: 'Record outcomes in GOV_BOUNDARY doc.',
        verification_method: 'review:gate result.',
        closure_evidence_required: ['N/A'],
      },
    ],
    verification: {
      idempotency_analysis: 'Synthetic.',
      replay_test: 'Synthetic.',
      rollback_plan: 'N/A (synthetic).',
    },
    readiness: { status: 'NOT_READY', labels: [] },
  };
};

const runGate = (inputPathAbs) => {
  try {
    const out = exec('node', ['tools/review-gate.mjs', 'review-policy.json', inputPathAbs]);
    return { ok: true, out };
  } catch (err) {
    const stdout = err?.stdout || '';
    const stderr = err?.stderr || '';
    const combined = String(stdout) + String(stderr);
    return { ok: false, out: combined };
  }
};

const tests = [
  {
    id: 'T1_FAIL_COMPLEX_MISSING_TENANT_VERIFICATION',
    name: 'Fail correctly: complex packet missing tenant verification keys',
    purpose:
      'Stress complexity + multi-domain triggering; ensure gate blocks when tenant_isolation verification keys are missing.',
    expected_failure: 'Gate should fail requiring tenant_isolation verification keys (tenant_boundary_analysis, runtime_negative_test, rollback_plan).',
    classification_expected: 'FAIL CORRECTLY',
    build: ({ runId, generatedAt, runDirAbs }) => {
      const input = makeBaseSubmission({
        runId,
        generatedAt,
        changeId: 'CHANGE-BOUNDARY-T1-COMPLEX-MISSING-TENANT-VERIFICATION',
        title: 'Boundary T1: Complex packet missing tenant_isolation verification',
      });
      input.domain_tags = ['money_state', 'tenant_isolation'];
      input.trigger_evidence.derived_domain_tags = ['money_state', 'tenant_isolation'];
      input.scenarios = canonicalScenarioCategories.map((cat) => ({
        category: cat,
        scenario: `Boundary scenario: ${cat}`,
        expected_behavior: 'Structural requirements satisfied.',
        verification_method: 'review:gate pass.',
        evidence_required: ['artifacts:log', 'artifacts:test_result'],
      }));
      input.risk_acceptances = [
        {
          owner: 'UNASSIGNED',
          reason: 'Synthetic accepted risk for boundary test.',
          probability: 'LOW',
          blast_radius: 'LOW',
          expires_at: new Date(Date.parse(generatedAt) + 7 * 24 * 3600 * 1000).toISOString(),
        },
      ];
      input.override = {
        requested_by: 'boundary-test',
        approved_by: 'boundary-test',
        reason: 'Synthetic override for structural coverage.',
        rollback_plan: 'N/A (synthetic).',
        expires_at: new Date(Date.parse(generatedAt) + 24 * 3600 * 1000).toISOString(),
      };
      input.findings.push({
        id: 'F-INFO-BOUNDARY-2',
        title: 'Second synthetic finding',
        severity: 'INFO',
        business_impact: 'Exercises findings array.',
        rule_violated: 'None',
        proof: ['tools/review-gate.mjs'],
        recommended_action: 'None.',
        verification_method: 'N/A',
        closure_evidence_required: ['N/A'],
      });
      input.artifacts = createStandardArtifacts({ runId, runDirAbs });
      // Tighten scenario evidence to point to a real artifact file (keeps signal focused on missing verification keys).
      const logPath = input.artifacts.find((a) => a.type === 'log')?.path;
      if (logPath) {
        for (const s of input.scenarios) s.evidence_required = [logPath];
      }
      return input;
    },
  },
  {
    id: 'T2_FAIL_MISSING_ARTIFACT_PATH',
    name: 'Fail (missing artifact path)',
    purpose: 'Ensure gate fails if an artifact path is missing on disk.',
    expected_failure: 'Gate should fail due to artifact_rules.require_paths_exist (missing artifact path).',
    classification_expected: 'FAIL CORRECTLY',
    build: ({ runId, generatedAt, runDirAbs }) => {
      const input = makeBaseSubmission({
        runId,
        generatedAt,
        changeId: 'CHANGE-BOUNDARY-T2-MISSING-ARTIFACT-PATH',
        title: 'Boundary T2: Missing artifact path',
      });
      input.artifacts = createStandardArtifacts({ runId, runDirAbs });
      const logPath = input.artifacts.find((a) => a.type === 'log')?.path;
      if (logPath) {
        for (const s of input.scenarios) s.evidence_required = [logPath];
      }
      // Break one required, non-empty type path.
      const firstLog = input.artifacts.find((a) => a.type === 'log');
      if (firstLog) firstLog.path = 'artifacts/does-not-exist.log';
      return input;
    },
  },
  {
    id: 'T3_PASS_DANGEROUS_WRONG_DOMAIN_TAG',
    name: 'Pass (danger): unknown domain tag',
    purpose: 'Probe whether gate rejects non-canonical domain tags (it currently does not).',
    expected_failure: 'Gate should reject non-canonical domain tags (not in review-policy.json.critical_domains).',
    classification_expected: 'FAIL CORRECTLY',
    build: ({ runId, generatedAt, runDirAbs }) => {
      const input = makeBaseSubmission({
        runId,
        generatedAt,
        changeId: 'CHANGE-BOUNDARY-T3-WRONG-DOMAIN-TAG',
        title: 'Boundary T3: Unknown domain tag should be rejected (probe)',
      });
      input.domain_tags = ['money_state_v2']; // not in critical_domains
      input.trigger_evidence.derived_domain_tags = ['money_state_v2'];
      input.artifacts = createStandardArtifacts({ runId, runDirAbs });
      const logPath = input.artifacts.find((a) => a.type === 'log')?.path;
      if (logPath) {
        for (const s of input.scenarios) s.evidence_required = [logPath];
      }
      // Keep scenarios present so it still looks "complete".
      return input;
    },
  },
  {
    id: 'T4_FAIL_RISK_NO_EXPIRY',
    name: 'Fail (accepted risk without expiry)',
    purpose: 'Ensure gate fails if risk_acceptances entry has no expires_at.',
    expected_failure: 'Gate should fail because risk_acceptances[0].expires_at is required and must be ISO datetime.',
    classification_expected: 'FAIL CORRECTLY',
    build: ({ runId, generatedAt, runDirAbs }) => {
      const input = makeBaseSubmission({
        runId,
        generatedAt,
        changeId: 'CHANGE-BOUNDARY-T4-RISK-NO-EXPIRY',
        title: 'Boundary T4: Risk acceptance missing expiry',
      });
      input.risk_acceptances = [{ owner: 'UNASSIGNED', reason: 'Synthetic', probability: 'LOW', blast_radius: 'LOW' }];
      input.artifacts = createStandardArtifacts({ runId, runDirAbs });
      const logPath = input.artifacts.find((a) => a.type === 'log')?.path;
      if (logPath) {
        for (const s of input.scenarios) s.evidence_required = [logPath];
      }
      return input;
    },
  },
  {
    id: 'T5_PASS_DANGEROUS_HEARTBEAT_NOT_VERIFIED',
    name: 'Fail (correct): artifact heartbeat mismatch',
    purpose: 'Ensure gate verifies embedded run_id in artifact content and rejects mismatches.',
    expected_failure: 'Gate should reject artifacts whose embedded run_id does not match review-input.json.run_id.',
    classification_expected: 'FAIL CORRECTLY',
    build: ({ runId, generatedAt, runDirAbs }) => {
      const input = makeBaseSubmission({
        runId,
        generatedAt,
        changeId: 'CHANGE-BOUNDARY-T5-HEARTBEAT-MISMATCH',
        title: 'Boundary T5: Artifact content run_id mismatch (probe)',
      });
      input.artifacts = createStandardArtifacts({ runId, runDirAbs });
      const logPath = input.artifacts.find((a) => a.type === 'log')?.path;
      if (logPath) {
        for (const s of input.scenarios) s.evidence_required = [logPath];
      }
      const logArtifact = input.artifacts.find((a) => a.type === 'log');
      if (logArtifact?.path) {
        const abs = path.resolve(repoRoot, logArtifact.path);
        // Overwrite content with a mismatched run_id; gate should still pass today.
        writeText(abs, `run_id: WRONG_RUN_ID\ntimestamp: ${nowIso()}\nchange_id: CHANGE-BOUNDARY-TESTS\n`);
      }
      return input;
    },
  },
  {
    id: 'T6_FAIL_SCENARIO_MISSING_EVIDENCE_REQUIRED',
    name: 'Fail (scenario missing evidence_required)',
    purpose: 'Ensure gate fails if a scenario entry is missing evidence_required array (triggered domains).',
    expected_failure: 'Gate should fail because scenarios[*].evidence_required must be a non-empty array.',
    classification_expected: 'FAIL CORRECTLY',
    build: ({ runId, generatedAt, runDirAbs }) => {
      const input = makeBaseSubmission({
        runId,
        generatedAt,
        changeId: 'CHANGE-BOUNDARY-T6-SCENARIO-MISSING-EVIDENCE',
        title: 'Boundary T6: Scenario missing evidence_required',
      });
      // Trigger domain.
      input.domain_tags = ['money_state'];
      input.trigger_evidence.derived_domain_tags = ['money_state'];
      // Break first scenario.
      if (input.scenarios?.[0]) delete input.scenarios[0].evidence_required;
      input.artifacts = createStandardArtifacts({ runId, runDirAbs });
      const logPath = input.artifacts.find((a) => a.type === 'log')?.path;
      if (logPath) {
        for (const s of input.scenarios.slice(1)) s.evidence_required = [logPath];
      }
      return input;
    },
  },
  {
    id: 'T7_FAIL_BAD_READINESS_LABEL',
    name: 'Fail (bad readiness label)',
    purpose: 'Ensure gate fails on readiness.labels values that look plausible but are not in allowed_readiness_labels.',
    expected_failure: 'Gate should fail because readiness.labels contains a value not in review-policy.json.allowed_readiness_labels.',
    classification_expected: 'FAIL CORRECTLY',
    build: ({ runId, generatedAt, runDirAbs }) => {
      const input = makeBaseSubmission({
        runId,
        generatedAt,
        changeId: 'CHANGE-BOUNDARY-T7-BAD-READINESS-LABEL',
        title: 'Boundary T7: Bad readiness label',
      });
      input.readiness = { status: 'READY', labels: ['LOCAL_PROVEN'] };
      input.artifacts = createStandardArtifacts({ runId, runDirAbs });
      const logPath = input.artifacts.find((a) => a.type === 'log')?.path;
      if (logPath) {
        for (const s of input.scenarios) s.evidence_required = [logPath];
      }
      return input;
    },
  },
  {
    id: 'T8_FAIL_MISSING_COVERAGE_LINKAGE',
    name: 'Fail (missing coverage linkage)',
    purpose: 'Ensure gate fails when coverage_report.files_analyzed does not include every scope.included file.',
    expected_failure: 'Gate should fail because coverage_report.files_analyzed must include scope.included.',
    classification_expected: 'FAIL CORRECTLY',
    build: ({ runId, generatedAt, runDirAbs }) => {
      const input = makeBaseSubmission({
        runId,
        generatedAt,
        changeId: 'CHANGE-BOUNDARY-T8-MISSING-COVERAGE-LINKAGE',
        title: 'Boundary T8: Missing coverage linkage',
      });
      // Force mismatch: scope includes a file that is not analyzed.
      input.scope.included = ['tools/review-gate.mjs', 'review-policy.json'].filter((p) =>
        fs.existsSync(path.resolve(repoRoot, p))
      );
      input.coverage_report.files_analyzed = ['tools/review-gate.mjs'].filter((p) =>
        fs.existsSync(path.resolve(repoRoot, p))
      );
      input.artifacts = createStandardArtifacts({ runId, runDirAbs });
      const logPath = input.artifacts.find((a) => a.type === 'log')?.path;
      if (logPath) {
        for (const s of input.scenarios) s.evidence_required = [logPath];
      }
      return input;
    },
  },
  {
    id: 'T9_PASS_DANGEROUS_SCENARIO_EVIDENCE_NOT_RESOLVABLE',
    name: 'Pass (danger): scenario evidence_required points to missing path',
    purpose:
      'Probe whether the gate verifies scenario evidence_required entries are resolvable paths (it currently does not).',
    expected_failure: 'Gate should fail when scenarios[*].evidence_required points to missing artifact paths.',
    classification_expected: 'FAIL CORRECTLY',
    build: ({ runId, generatedAt, runDirAbs }) => {
      const input = makeBaseSubmission({
        runId,
        generatedAt,
        changeId: 'CHANGE-BOUNDARY-T9-SCENARIO-EVIDENCE-NOT-RESOLVABLE',
        title: 'Boundary T9: Scenario evidence_required not resolvable (probe)',
      });
      input.artifacts = createStandardArtifacts({ runId, runDirAbs });
      // Keep evidence_required non-empty, but point at a missing file.
      if (Array.isArray(input.scenarios) && input.scenarios.length) {
        input.scenarios[0].evidence_required = ['artifacts/does-not-exist.log'];
      }
      return input;
    },
  },
  {
    id: 'T10_FAIL_STALE_ARTIFACT_BY_TIMESTAMP',
    name: 'Fail (stale artifact via generated_at)',
    purpose: 'Ensure stale artifact max-age enforcement triggers when generated_at is far after artifact mtime.',
    expected_failure: 'Gate should fail due to artifact_rules.max_age_hours when generated_at is far in the future.',
    classification_expected: 'FAIL CORRECTLY',
    build: ({ runId, generatedAt, runDirAbs }) => {
      const input = makeBaseSubmission({
        runId,
        generatedAt,
        changeId: 'CHANGE-BOUNDARY-T10-STALE-ARTIFACT',
        title: 'Boundary T10: Stale artifact enforcement',
      });
      input.artifacts = createStandardArtifacts({ runId, runDirAbs });
      const logPath = input.artifacts.find((a) => a.type === 'log')?.path;
      if (logPath) {
        for (const s of input.scenarios) s.evidence_required = [logPath];
      }
      // Force generated_at far in the future relative to artifact mtime.
      input.generated_at = new Date(Date.parse(generatedAt) + 365 * 24 * 3600 * 1000).toISOString();
      input.decider.approved_at = input.generated_at;
      return input;
    },
  },
];

const computeClassification = ({ expected, ok }) => {
  // Use the requested vocabulary for stress-case quality signals.
  if (expected === 'FAIL CORRECTLY') return ok ? 'PASSES WHEN IT SHOULD FAIL' : 'FAIL CORRECTLY';
  if (expected === 'PASSES WHEN IT SHOULD FAIL') return ok ? 'PASSES WHEN IT SHOULD FAIL' : 'FAIL TOO LATE';
  return ok ? 'PASSES WHEN IT SHOULD FAIL' : 'FAIL UNCLEARLY';
};

const extractFailureLines = (gateOutput) => {
  const lines = String(gateOutput || '').split(/\r?\n/);
  const bullets = [];
  for (const line of lines) {
    const m = line.match(/^\s*-\s+(.*)\s*$/);
    if (m) bullets.push(m[1]);
  }
  return bullets;
};

const escapePipes = (value) => String(value || '').replaceAll('|', '\\|');

const lessonFromClassification = (c) => {
  if (c === 'FAIL CORRECTLY') return 'Gate enforced the boundary as expected; keep docs/templates aligned to this rule.';
  if (c === 'FAIL UNCLEARLY') return 'Gate failed but signal is unclear; improve error clarity or doc mapping.';
  if (c === 'FAIL TOO LATE') return 'Gate blocked a risky submission, but only after deeper steps; consider earlier/lighter checks.';
  if (c === 'PASSES WHEN IT SHOULD FAIL') return 'Enforcement gap; add policy/gate check or require human review rule to cover the gap.';
  if (c === 'TOO HARD TO USE') return 'Process friction; reduce required fields or provide generators to avoid manual error.';
  return 'Review manually.';
};

const results = [];
const boundaryRoot = path.resolve(repoRoot, 'artifacts/boundary-tests');
fs.mkdirSync(boundaryRoot, { recursive: true });

for (const t of tests) {
  const runId = nowIso();
  const generatedAt = nowIso(); // placeholder; we stamp generated_at after artifacts are written to avoid mtime warnings.
  const runDirAbs = path.join(boundaryRoot, `${t.id}__${safeRunDirName(runId)}`);

  const input = t.build({ runId, generatedAt, runDirAbs });
  // Ensure artifacts exist after any test-specific overwrites.
  const inputPathAbs = path.join(runDirAbs, 'review-input.json');

  // Stamp generated_at at final assembly time (after artifact writes) unless the test intentionally overrides it.
  if (!input.generated_at) input.generated_at = nowIso();
  if (input.decider && typeof input.decider === 'object' && !Array.isArray(input.decider)) {
    input.decider.approved_at = input.generated_at;
  }

  writeJson(inputPathAbs, input);

  const gate = runGate(inputPathAbs);
  const classification = computeClassification({
    expected: t.classification_expected,
    ok: gate.ok,
  });
  const failures = gate.ok ? [] : extractFailureLines(gate.out);
  results.push({
    id: t.id,
    name: t.name,
    purpose: t.purpose,
    expected_failure: t.expected_failure,
    actual_failure: gate.ok ? 'None (gate passed)' : failures.join(' | ') || 'Gate failed (no bullet errors parsed)',
    classification,
    lesson_learned: lessonFromClassification(classification),
    run_id: runId,
    packet_path: path.relative(repoRoot, inputPathAbs).replaceAll('\\', '/'),
    gate_output: gate.out.trim(),
  });
}

const docPath = path.resolve(repoRoot, 'docs/governance/GOVERNANCE_BOUNDARY_TESTS.md');
const existing = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '# Governance Boundary Tests\n\n';
const lines = [];
lines.push(existing.trimEnd());
lines.push('');
lines.push('---');
lines.push('');
lines.push(`## Trial Set — ${nowIso()}`);
lines.push('');
lines.push('| test case | expected failure | actual failure | classification | lesson learned |');
lines.push('|---|---|---|---|---|');
for (const r of results) {
  const testCase = `${r.id}: ${r.name} (${r.packet_path})`;
  lines.push(
    `| ${escapePipes(testCase)} | ${escapePipes(r.expected_failure)} | ${escapePipes(r.actual_failure)} | ${escapePipes(
      r.classification
    )} | ${escapePipes(r.lesson_learned)} |`
  );
}
lines.push('');
lines.push('Notes:');
lines.push('- Packets are stored under `artifacts/boundary-tests/`.');
lines.push('- This log is append-only; do not edit prior trial sets. Re-run the tool to add a new trial set.');
lines.push('');

writeText(docPath, lines.join('\n') + '\n');

console.log('GOVERNANCE BOUNDARY TESTS: complete');
for (const r of results) {
  console.log(`- ${r.id}: ${r.classification} :: ${r.packet_path}`);
}

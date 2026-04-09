#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const toIsoDate = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};
const isHexSha = (value) => typeof value === 'string' && /^[0-9a-f]{7,40}$/i.test(value.trim());

const asStringArray = (value) =>
  Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim()) : [];

const fail = (errors) => {
  console.error('\nREVIEW GATE: FAILED\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
};

const ok = (warnings) => {
  console.log('\nREVIEW GATE: PASSED\n');
  if (warnings.length) {
    console.log('Warnings:');
    for (const warning of warnings) console.log(`- ${warning}`);
  }
};

const policyPath = process.argv[2] || 'review-policy.json';
const inputPath = process.argv[3] || 'review-input.json';

if (!fs.existsSync(policyPath)) fail([`Missing policy file: ${policyPath}`]);
if (!fs.existsSync(inputPath)) fail([`Missing review input file: ${inputPath}`]);

const policy = readJson(policyPath);
const input = readJson(inputPath);

const errors = [];
const warnings = [];

const repoRoot = process.cwd();
const resolveRepoPath = (p) => path.resolve(repoRoot, String(p || ''));

const artifactRules = policy.artifact_rules || {};
const criticalDomains = Array.isArray(policy.critical_domains) ? policy.critical_domains : [];
const requireRunIdMatchTypes = Array.isArray(artifactRules.require_run_id_match_types)
  ? artifactRules.require_run_id_match_types
  : [];

const extractRunIdFromText = (text) => {
  if (typeof text !== 'string') return null;
  const m = text.match(/^\s*run_id:\s*(\S+)\s*$/im);
  return m ? m[1] : null;
};

const extractRunIdFromFile = (filePath, typeHint) => {
  try {
    const lower = String(filePath).toLowerCase();
    if (typeHint === 'manifest' || lower.endsWith('.json')) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const runId = parsed?.run_id;
      return typeof runId === 'string' && runId.trim() ? runId.trim() : null;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    return extractRunIdFromText(raw.slice(0, 8000));
  } catch {
    return null;
  }
};

// 1) Top-level fields
for (const field of policy.required_top_level_fields || []) {
  if (!(field in input)) errors.push(`Missing top-level field: ${field}`);
}

if (errors.length) fail(errors);

// Validate generated_at, if present/required
const generatedAt = toIsoDate(input.generated_at);
if ('generated_at' in input && !generatedAt) {
  errors.push('Invalid generated_at (must be ISO datetime string)');
}

// Validate source_commit shape
if (typeof input.source_commit !== 'string' || !isHexSha(input.source_commit)) {
  errors.push('Invalid source_commit (must be git SHA-like hex string)');
}

// Validate pr_id / run_id
if (typeof input.pr_id !== 'string' || !input.pr_id.trim()) {
  errors.push('Invalid pr_id (must be non-empty string; use \"LOCAL\" if not in PR)');
}
if (typeof input.run_id !== 'string' || !toIsoDate(input.run_id)) {
  errors.push('Invalid run_id (must be ISO datetime string)');
}

// files_changed integrity
const filesChanged = asStringArray(input.files_changed);
if (filesChanged.length === 0) errors.push('files_changed must be a non-empty string array');

// scope integrity
const scope = input.scope || {};
const scopeIncluded = asStringArray(scope.included);
if (scopeIncluded.length === 0) errors.push('scope.included must be a non-empty string array');
for (const filePath of scopeIncluded) {
  if (!filesChanged.includes(filePath)) {
    errors.push(`scope.included must be listed in files_changed: ${filePath}`);
  }
}

// decider integrity
const decider = input.decider || {};
if (typeof decider !== 'object' || Array.isArray(decider) || decider === null) {
  errors.push('decider must be an object');
} else {
  if (typeof decider.name !== 'string' || !decider.name.trim()) errors.push('decider.name is required');
  if (typeof decider.role !== 'string' || !decider.role.trim()) errors.push('decider.role is required');
  const approvedAt = toIsoDate(decider.approved_at);
  if (!approvedAt) errors.push('decider.approved_at must be ISO datetime string');
}

// risk_acceptances integrity (must exist; may be empty)
if (!Array.isArray(input.risk_acceptances)) {
  errors.push('risk_acceptances must be an array (may be empty)');
} else {
  for (const [i, ra] of input.risk_acceptances.entries()) {
    if (typeof ra !== 'object' || ra === null || Array.isArray(ra)) {
      errors.push(`risk_acceptances[${i}] must be an object`);
      continue;
    }
    const expiresAt = toIsoDate(ra.expires_at);
    if (!expiresAt) errors.push(`risk_acceptances[${i}].expires_at must be ISO datetime string`);
    if (generatedAt && expiresAt && expiresAt.getTime() <= generatedAt.getTime()) {
      errors.push(`risk_acceptances[${i}].expires_at must be after generated_at`);
    }

    if (ra.probability && policy.allowed_risk_probability && !policy.allowed_risk_probability.includes(ra.probability)) {
      errors.push(`risk_acceptances[${i}].probability must be one of allowed_risk_probability`);
    }
    if (ra.blast_radius && policy.allowed_risk_blast_radius && !policy.allowed_risk_blast_radius.includes(ra.blast_radius)) {
      errors.push(`risk_acceptances[${i}].blast_radius must be one of allowed_risk_blast_radius`);
    }
  }
}

// domain_tags integrity
const tags = asStringArray(input.domain_tags);
for (const t of tags) {
  if (!criticalDomains.includes(t)) {
    errors.push(`Invalid domain_tag (must be one of policy.critical_domains): ${t}`);
  }
}

// scenarios integrity (required when triggered)
const isTriggered = tags.some((t) => criticalDomains.includes(t));
if (!Array.isArray(input.scenarios)) {
  errors.push('scenarios must be an array');
} else if (isTriggered) {
  const requiredCats = Array.isArray(policy.required_scenario_categories_when_triggered)
    ? policy.required_scenario_categories_when_triggered
    : [];
  const presentCats = new Set();
  for (const [i, s] of input.scenarios.entries()) {
    if (typeof s !== 'object' || s === null || Array.isArray(s)) {
      errors.push(`scenarios[${i}] must be an object`);
      continue;
    }
    if (typeof s.category !== 'string' || !s.category.trim()) errors.push(`scenarios[${i}].category is required`);
    if (typeof s.scenario !== 'string' || !s.scenario.trim()) errors.push(`scenarios[${i}].scenario is required`);
    if (typeof s.expected_behavior !== 'string' || !s.expected_behavior.trim())
      errors.push(`scenarios[${i}].expected_behavior is required`);
    if (typeof s.verification_method !== 'string' || !s.verification_method.trim())
      errors.push(`scenarios[${i}].verification_method is required`);
    if (!Array.isArray(s.evidence_required) || s.evidence_required.length === 0)
      errors.push(`scenarios[${i}].evidence_required must be a non-empty array`);
    if (Array.isArray(s.evidence_required)) {
      for (const [j, evidencePath] of s.evidence_required.entries()) {
        if (typeof evidencePath !== 'string' || !evidencePath.trim()) {
          errors.push(`scenarios[${i}].evidence_required[${j}] must be a non-empty string path`);
          continue;
        }
        const resolved = resolveRepoPath(evidencePath);
        if (artifactRules.require_paths_exist !== false && !fs.existsSync(resolved)) {
          errors.push(`scenarios[${i}].evidence_required[${j}] path does not exist: ${evidencePath}`);
        }
      }
    }

    if (typeof s.category === 'string' && s.category.trim()) presentCats.add(s.category.trim());
  }
  for (const cat of requiredCats) {
    if (!presentCats.has(cat)) errors.push(`Missing required scenario category: ${cat}`);
  }
}

// concurrency model integrity
const cm = input.concurrency_model || {};
if (typeof cm !== 'object' || cm === null || Array.isArray(cm)) {
  errors.push('concurrency_model must be an object');
} else {
  const model = typeof cm.model === 'string' ? cm.model.trim() : '';
  if (!model) errors.push('concurrency_model.model is required');
  if (policy.allowed_concurrency_models && !policy.allowed_concurrency_models.includes(model)) {
    errors.push(`concurrency_model.model must be one of allowed_concurrency_models`);
  }
  if (!Array.isArray(cm.guarantees) || cm.guarantees.length === 0) errors.push('concurrency_model.guarantees must be non-empty array');
  if (!Array.isArray(cm.non_guarantees) || cm.non_guarantees.length === 0) errors.push('concurrency_model.non_guarantees must be non-empty array');
  if (model === 'lock_based' && (typeof cm.lock_strategy !== 'string' || !cm.lock_strategy.trim())) {
    errors.push('concurrency_model.lock_strategy is required when model=lock_based');
  }
}

// ops impact integrity
const ops = input.ops_impact || {};
if (typeof ops !== 'object' || ops === null || Array.isArray(ops)) {
  errors.push('ops_impact must be an object');
} else {
  if (typeof ops.alert_dedupe_identity !== 'string' || !ops.alert_dedupe_identity.trim())
    errors.push('ops_impact.alert_dedupe_identity is required');
  if (typeof ops.max_open_alerts_per_entity !== 'string' || !ops.max_open_alerts_per_entity.trim())
    errors.push('ops_impact.max_open_alerts_per_entity is required');
  if (typeof ops.task_dedupe_rule !== 'string' || !ops.task_dedupe_rule.trim())
    errors.push('ops_impact.task_dedupe_rule is required');
}

// trigger evidence integrity
const te = input.trigger_evidence || {};
if (typeof te !== 'object' || te === null || Array.isArray(te)) {
  errors.push('trigger_evidence must be an object');
} else {
  const derived = asStringArray(te.derived_domain_tags);
  const inputs = asStringArray(te.derivation_inputs);
  if (derived.length === 0) errors.push('trigger_evidence.derived_domain_tags must be non-empty array');
  if (inputs.length === 0) errors.push('trigger_evidence.derivation_inputs must be non-empty array');
  for (const t of tags) {
    if (!derived.includes(t)) errors.push(`trigger_evidence.derived_domain_tags must include declared domain_tag: ${t}`);
  }
}

// optional override integrity
if ('override' in input && input.override != null) {
  const ov = input.override;
  if (typeof ov !== 'object' || ov === null || Array.isArray(ov)) {
    errors.push('override must be an object when present');
  } else {
    if (typeof ov.requested_by !== 'string' || !ov.requested_by.trim()) errors.push('override.requested_by is required');
    if (typeof ov.approved_by !== 'string' || !ov.approved_by.trim()) errors.push('override.approved_by is required');
    if (typeof ov.reason !== 'string' || !ov.reason.trim()) errors.push('override.reason is required');
    if (typeof ov.rollback_plan !== 'string' || !ov.rollback_plan.trim()) errors.push('override.rollback_plan is required');
    const exp = toIsoDate(ov.expires_at);
    if (!exp) errors.push('override.expires_at must be ISO datetime string');
  }
}

// 2) Artifacts
if (!Array.isArray(input.artifacts) || input.artifacts.length === 0) {
  errors.push('No artifacts provided');
} else {
  const artifactTypes = input.artifacts.map((a) => a?.type).filter(Boolean);

  for (const requiredType of policy.required_artifact_types || []) {
    if (!artifactTypes.includes(requiredType)) {
      errors.push(`Missing required artifact type: ${requiredType}`);
    }
  }

  const onlyForbiddenProof =
    artifactTypes.length > 0 &&
    artifactTypes.every((t) => (policy.forbidden_as_sole_proof || []).includes(t));
  if (onlyForbiddenProof) {
    errors.push('Artifacts rely only on forbidden-as-sole-proof types');
  }

  for (const [idx, artifact] of input.artifacts.entries()) {
    const type = artifact?.type;
    if (!type) {
      errors.push(`Artifact[${idx}] missing type`);
      continue;
    }

    const hasPath = typeof artifact?.path === 'string' && artifact.path.trim().length > 0;
    const hasSnippet = typeof artifact?.snippet === 'string' && artifact.snippet.trim().length > 0;

    if (!hasPath && !hasSnippet) {
      errors.push(`Artifact[${idx}] (${type}) missing path or snippet`);
      continue;
    }

    if (hasPath) {
      const resolved = resolveRepoPath(artifact.path);
      if (artifactRules.require_paths_exist !== false && !fs.existsSync(resolved)) {
        errors.push(`Artifact[${idx}] (${type}) path does not exist: ${artifact.path}`);
      } else if (fs.existsSync(resolved)) {
        const stat = fs.statSync(resolved);
        if (
          (artifactRules.require_non_empty_types || []).includes(type) &&
          stat.isFile() &&
          stat.size === 0
        ) {
          errors.push(`Artifact[${idx}] (${type}) file is empty: ${artifact.path}`);
        }

        const maxAgeHours = artifactRules.max_age_hours;
        const maxAgeTypes = Array.isArray(artifactRules.max_age_hours_types)
          ? artifactRules.max_age_hours_types
          : null;
        const shouldEnforceAge =
          generatedAt &&
          isFiniteNumber(maxAgeHours) &&
          maxAgeHours > 0 &&
          (maxAgeTypes ? maxAgeTypes.includes(type) : true);

        if (shouldEnforceAge) {
          const ageMs = generatedAt.getTime() - stat.mtimeMs;
          if (ageMs < 0) {
            warnings.push(`Artifact[${idx}] (${type}) mtime is after generated_at: ${artifact.path}`);
          } else {
            const ageHours = ageMs / (1000 * 60 * 60);
            if (ageHours > maxAgeHours) {
              errors.push(
                `Artifact[${idx}] (${type}) is older than ${maxAgeHours}h relative to generated_at: ${artifact.path}`
              );
            }
          }
        }

        if (requireRunIdMatchTypes.includes(type)) {
          const artifactRunId = extractRunIdFromFile(resolved, type);
          if (!artifactRunId) {
            errors.push(`Artifact[${idx}] (${type}) missing run_id header/field: ${artifact.path}`);
          } else if (artifactRunId !== input.run_id) {
            errors.push(
              `Artifact[${idx}] (${type}) run_id mismatch (expected ${input.run_id}, got ${artifactRunId}): ${artifact.path}`
            );
          }
        }
      }
    }

    if (type === 'code_reference') {
      if (!hasSnippet) errors.push(`Artifact[${idx}] (code_reference) missing snippet`);
      if (hasSnippet && artifact.snippet.trim().length < 10) {
        warnings.push(`Artifact[${idx}] (code_reference) snippet is very short`);
      }
      if (
        artifactRules.code_reference_must_match_file &&
        hasPath &&
        hasSnippet &&
        fs.existsSync(resolveRepoPath(artifact.path))
      ) {
        const resolved = resolveRepoPath(artifact.path);
        try {
          const fileText = fs.readFileSync(resolved, 'utf8');
          if (!fileText.includes(artifact.snippet)) {
            errors.push(
              `Artifact[${idx}] (code_reference) snippet not found in file: ${artifact.path}`
            );
          }
        } catch (err) {
          errors.push(
            `Artifact[${idx}] (code_reference) failed reading file for snippet check: ${artifact.path}`
          );
        }
      }
    }
  }
}

// 3) Coverage report
const coverageReport = input.coverage_report || {};
for (const field of policy.required_coverage_fields || []) {
  if (!(field in coverageReport)) errors.push(`Missing coverage_report.${field}`);
}
if (Array.isArray(coverageReport.files_analyzed) && coverageReport.files_analyzed.length === 0) {
  errors.push('coverage_report.files_analyzed is empty');
}
// Must cover scope.included
const filesAnalyzed = asStringArray(coverageReport.files_analyzed);
for (const inc of scopeIncluded) {
  if (!filesAnalyzed.includes(inc)) {
    errors.push(`coverage_report.files_analyzed must include scope.included file: ${inc}`);
  }
}
if (
  Array.isArray(coverageReport.uncertainty_boundaries) &&
  coverageReport.uncertainty_boundaries.length === 0
) {
  warnings.push('No uncertainty boundaries listed');
}
if (Array.isArray(coverageReport.files_analyzed)) {
  for (const filePath of coverageReport.files_analyzed) {
    if (typeof filePath !== 'string' || !filePath.trim()) continue;
    const resolved = resolveRepoPath(filePath);
    if (!fs.existsSync(resolved)) {
      warnings.push(`coverage_report.files_analyzed missing on disk: ${filePath}`);
    }
  }
}

// 4) Findings
if (!Array.isArray(input.findings) || input.findings.length === 0) {
  errors.push('No findings provided');
} else {
  for (const [i, finding] of input.findings.entries()) {
    for (const field of policy.required_finding_fields || []) {
      if (!(field in finding)) errors.push(`Finding[${i}] missing field: ${field}`);
    }
    if (Array.isArray(finding.proof) && finding.proof.length === 0) {
      errors.push(`Finding[${i}] has empty proof array`);
    }
    if (Array.isArray(finding.closure_evidence_required) && finding.closure_evidence_required.length === 0) {
      errors.push(`Finding[${i}] has empty closure_evidence_required array`);
    }
  }
}

// 5) Critical domain requirements
const verification = input.verification || {};

for (const tag of tags) {
  const reqs = policy.critical_change_requirements?.[tag];
  if (!reqs) continue;
  for (const req of reqs) {
    if (!(req in verification)) {
      errors.push(`Critical domain '${tag}' requires verification.${req}`);
    }
  }
}

// 6) Readiness
if (!input.readiness || !policy.allowed_readiness?.includes(input.readiness.status)) {
  errors.push('Invalid or missing readiness.status');
}
if (input.readiness) {
  const labels = asStringArray(input.readiness.labels);
  for (const label of labels) {
    if (policy.allowed_readiness_labels && !policy.allowed_readiness_labels.includes(label)) {
      errors.push(`Invalid readiness.labels value: ${label}`);
    }
  }
  if (labels.includes('P0-02: PRODUCTION-VALIDATED')) {
    const prodArtifacts = Array.isArray(input.readiness.production_artifacts) ? input.readiness.production_artifacts : [];
    if (prodArtifacts.length === 0) {
      errors.push('P0-02: PRODUCTION-VALIDATED requires readiness.production_artifacts non-empty');
    }
  }
}

// 7) Hard business rules
if (tags.includes('money_state')) {
  if (!('replay_test' in verification)) errors.push('money_state changes require replay_test');
}

if (tags.includes('state_machine')) {
  if (!('migration_plan' in verification)) errors.push('state_machine changes require migration_plan');
  if (!('legacy_data_plan' in verification)) errors.push('state_machine changes require legacy_data_plan');
}

if (tags.includes('tenant_isolation')) {
  if (!verification.runtime_negative_test) errors.push('tenant_isolation changes require runtime_negative_test');
}

// 8) Stronger quality checks
const artifactTypes = Array.isArray(input.artifacts) ? input.artifacts.map((a) => a?.type).filter(Boolean) : [];
if (artifactTypes.includes('screenshot') && artifactTypes.length === 1) {
  errors.push('Screenshots cannot be the only proof');
}

if (typeof input.summary === 'string' && input.summary.trim().length < 25) {
  warnings.push('Summary is very thin');
}

if (errors.length) fail(errors);
ok(warnings);

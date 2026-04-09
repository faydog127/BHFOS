#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, value) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n', 'utf8');
};

const policyPath = path.resolve(repoRoot, 'review-policy.json');
if (!fs.existsSync(policyPath)) {
  console.error(`Missing policy file: ${policyPath}`);
  process.exit(1);
}
const policy = readJson(policyPath);

const schemaPath = path.resolve(repoRoot, 'docs/templates/review-input.schema.json');
const templatePath = path.resolve(repoRoot, 'docs/templates/review-input.template.json');

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'review-input.schema.json',
  title: 'review-input.json (review:gate submission)',
  type: 'object',
  additionalProperties: true,
  required: Array.isArray(policy.required_top_level_fields) ? policy.required_top_level_fields : [],
  properties: {
    gate_version: { type: 'string', minLength: 1 },
    change_id: { type: 'string', minLength: 1 },
    pr_id: { type: 'string', minLength: 1, description: 'Use "LOCAL" when not in a PR.' },
    title: { type: 'string', minLength: 1 },
    generated_at: { type: 'string', format: 'date-time' },
    source_commit: { type: 'string', pattern: '^[0-9a-fA-F]{7,40}$' },
    run_id: { type: 'string', format: 'date-time' },
    files_changed: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
    scope: {
      type: 'object',
      additionalProperties: true,
      required: ['included'],
      properties: {
        included: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
        excluded: { type: 'array', items: { type: 'string', minLength: 1 } },
      },
    },
    domain_tags: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      description: 'Trigger set is policy.critical_domains; schema stays permissive to match gate behavior.',
    },
    summary: { type: 'string', minLength: 1 },
    decider: {
      type: 'object',
      additionalProperties: true,
      required: ['name', 'role', 'approved_at'],
      properties: {
        name: { type: 'string', minLength: 1 },
        role: { type: 'string', minLength: 1 },
        approved_at: { type: 'string', format: 'date-time' },
      },
    },
    risk_acceptances: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['expires_at'],
        properties: {
          owner: { type: 'string' },
          reason: { type: 'string' },
          probability: { type: 'string', enum: policy.allowed_risk_probability || [] },
          blast_radius: { type: 'string', enum: policy.allowed_risk_blast_radius || [] },
          expires_at: { type: 'string', format: 'date-time' },
        },
      },
    },
    scenarios: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['category', 'scenario', 'expected_behavior', 'verification_method', 'evidence_required'],
        properties: {
          category: { type: 'string', minLength: 1 },
          scenario: { type: 'string', minLength: 1 },
          expected_behavior: { type: 'string', minLength: 1 },
          verification_method: { type: 'string', minLength: 1 },
          evidence_required: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
        },
      },
    },
    concurrency_model: {
      type: 'object',
      additionalProperties: true,
      required: ['model', 'guarantees', 'non_guarantees'],
      properties: {
        model: { type: 'string', enum: policy.allowed_concurrency_models || [] },
        guarantees: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
        non_guarantees: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
        lock_strategy: { type: 'string' },
      },
    },
    ops_impact: {
      type: 'object',
      additionalProperties: true,
      required: ['alert_dedupe_identity', 'max_open_alerts_per_entity', 'task_dedupe_rule'],
      properties: {
        alert_dedupe_identity: { type: 'string', minLength: 1 },
        max_open_alerts_per_entity: { type: 'string', minLength: 1 },
        task_dedupe_rule: { type: 'string', minLength: 1 },
      },
    },
    trigger_evidence: {
      type: 'object',
      additionalProperties: true,
      required: ['derived_domain_tags', 'derivation_inputs'],
      properties: {
        derived_domain_tags: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
        derivation_inputs: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
      },
    },
    artifacts: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['type', 'label', 'proof_of', 'path'],
        properties: {
          type: { type: 'string' },
          label: { type: 'string', minLength: 1 },
          proof_of: { type: 'string', minLength: 1 },
          path: { type: 'string', minLength: 1 },
          sha256: { type: 'string' },
          snippet: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          notes: { type: 'string' },
        },
      },
    },
    coverage_report: {
      type: 'object',
      additionalProperties: true,
      required: policy.required_coverage_fields || [],
      properties: {
        files_analyzed: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
        discovery_inputs: { type: 'array', items: { type: 'string', minLength: 1 } },
        excluded_scope: { type: 'array', items: { type: 'string', minLength: 1 } },
        uncertainty_boundaries: { type: 'array', items: { type: 'string', minLength: 1 } },
      },
    },
    findings: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: true,
        required: policy.required_finding_fields || [],
        properties: {
          id: { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1 },
          severity: { type: 'string', minLength: 1 },
          business_impact: { type: 'string', minLength: 1 },
          rule_violated: { type: 'string', minLength: 1 },
          proof: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
          recommended_action: { type: 'string', minLength: 1 },
          verification_method: { type: 'string', minLength: 1 },
          closure_evidence_required: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
        },
      },
    },
    verification: {
      type: 'object',
      additionalProperties: true,
      description: 'Critical-domain required keys are enforced by review:gate from policy.critical_change_requirements.',
    },
    readiness: {
      type: 'object',
      additionalProperties: true,
      required: ['status', 'labels'],
      properties: {
        status: { type: 'string', enum: policy.allowed_readiness || [] },
        labels: { type: 'array', items: { type: 'string', enum: policy.allowed_readiness_labels || [] } },
        production_artifacts: { type: 'array', items: { type: 'string', minLength: 1 } },
      },
    },
  },
};

const template = {
  $schema: './review-input.schema.json',
  gate_version: 'v1',
  change_id: 'CHANGE-REPLACE-ME',
  pr_id: 'LOCAL',
  title: 'REPLACE ME',
  generated_at: new Date().toISOString(),
  source_commit: '0000000',
  run_id: new Date().toISOString(),
  files_changed: ['REPLACE/ME.ts'],
  scope: { included: ['REPLACE/ME.ts'], excluded: [] },
  domain_tags: [],
  summary: 'REPLACE ME (what changed, why, and what proofs exist).',
  decider: { name: 'REPLACE ME', role: 'REPLACE ME', approved_at: new Date().toISOString() },
  risk_acceptances: [],
  scenarios: [
    {
      category: (policy.required_scenario_categories_when_triggered || [])[0] || 'bad_data',
      scenario: 'REPLACE ME',
      expected_behavior: 'REPLACE ME',
      verification_method: 'REPLACE ME',
      evidence_required: ['artifacts:log', 'artifacts:test_result'],
    },
  ],
  concurrency_model: {
    model: (policy.allowed_concurrency_models || [])[0] || 'dedupe_based',
    guarantees: ['REPLACE ME'],
    non_guarantees: ['REPLACE ME'],
  },
  ops_impact: {
    alert_dedupe_identity: 'REPLACE ME',
    max_open_alerts_per_entity: 'REPLACE ME',
    task_dedupe_rule: 'REPLACE ME',
  },
  trigger_evidence: {
    derived_domain_tags: ['REPLACE ME'],
    derivation_inputs: ['git diff --name-only <base>...HEAD'],
  },
  artifacts: [
    {
      type: (policy.required_artifact_types || [])[0] || 'log',
      label: 'REPLACE ME',
      proof_of: 'REPLACE ME',
      path: 'artifacts/runs/REPLACE_ME/stdout.log',
      created_at: new Date().toISOString(),
    },
  ],
  coverage_report: {
    files_analyzed: ['REPLACE/ME.ts'],
    discovery_inputs: ['rg -n "REPLACE" src'],
    excluded_scope: [],
    uncertainty_boundaries: ['REPLACE ME'],
  },
  findings: [
    {
      id: 'F-0001',
      title: 'REPLACE ME',
      severity: 'MEDIUM',
      business_impact: 'REPLACE ME',
      rule_violated: 'REPLACE ME',
      proof: ['path:line snippet OR artifact path'],
      recommended_action: 'REPLACE ME',
      verification_method: 'REPLACE ME',
      closure_evidence_required: ['REPLACE ME'],
    },
  ],
  verification: {},
  readiness: { status: (policy.allowed_readiness || [])[0] || 'NOT_READY', labels: [] },
};

writeJson(schemaPath, schema);
writeJson(templatePath, template);

console.log('Generated:');
console.log(`- ${path.relative(repoRoot, schemaPath)}`);
console.log(`- ${path.relative(repoRoot, templatePath)}`);


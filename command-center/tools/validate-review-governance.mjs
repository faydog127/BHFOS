#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const readText = (p) => fs.readFileSync(p, 'utf8');
const readJson = (p) => JSON.parse(readText(p));
const exists = (p) => fs.existsSync(p);
const resolveRepo = (p) => path.resolve(repoRoot, p);

const errors = [];
const warnings = [];

const policyPath = resolveRepo('review-policy.json');
const schemaPath = resolveRepo('docs/templates/review-input.schema.json');
const templatePath = resolveRepo('docs/templates/review-input.template.json');
const reviewMapPath = resolveRepo('docs/governance/REVIEW_MAP.md');

for (const requiredPath of [policyPath, schemaPath, templatePath, reviewMapPath]) {
  if (!exists(requiredPath)) errors.push(`Missing required file: ${path.relative(repoRoot, requiredPath)}`);
}

if (errors.length) {
  console.error('REVIEW GOVERNANCE VALIDATION: FAILED\n');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

const policy = readJson(policyPath);
const schema = readJson(schemaPath);
const template = readJson(templatePath);
const reviewMap = readText(reviewMapPath);

const asStringArray = (value) =>
  Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim()) : [];

const eqSet = (a, b) => {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
};

// 1) Policy ↔ schema: required fields
const policyRequired = new Set(asStringArray(policy.required_top_level_fields));
const schemaRequired = new Set(asStringArray(schema.required));
if (!eqSet(policyRequired, schemaRequired)) {
  const missingInSchema = [...policyRequired].filter((f) => !schemaRequired.has(f));
  const extraInSchema = [...schemaRequired].filter((f) => !policyRequired.has(f));
  if (missingInSchema.length) errors.push(`Schema missing required fields from policy: ${missingInSchema.join(', ')}`);
  if (extraInSchema.length) errors.push(`Schema has extra required fields not in policy: ${extraInSchema.join(', ')}`);
}

// 2) Template includes all required top-level fields (schema is the source for the list)
for (const f of schema.required || []) {
  if (!(f in template)) errors.push(`Template missing top-level field: ${f}`);
}

// 3) Policy ↔ schema: enums that are intentionally mirrored
const expectedEnums = [
  { name: 'allowed_concurrency_models', from: policy.allowed_concurrency_models, at: schema?.properties?.concurrency_model?.properties?.model?.enum },
  { name: 'allowed_readiness', from: policy.allowed_readiness, at: schema?.properties?.readiness?.properties?.status?.enum },
  { name: 'allowed_readiness_labels', from: policy.allowed_readiness_labels, at: schema?.properties?.readiness?.properties?.labels?.items?.enum },
  { name: 'allowed_risk_probability', from: policy.allowed_risk_probability, at: schema?.properties?.risk_acceptances?.items?.properties?.probability?.enum },
  { name: 'allowed_risk_blast_radius', from: policy.allowed_risk_blast_radius, at: schema?.properties?.risk_acceptances?.items?.properties?.blast_radius?.enum },
];

for (const e of expectedEnums) {
  const left = new Set(asStringArray(e.from));
  const right = new Set(asStringArray(e.at));
  if (!eqSet(left, right)) {
    errors.push(`Schema enum drift for ${e.name} (policy ≠ schema). Run: npm run generate:review-templates`);
  }
}

// 4) REVIEW_MAP must not reference missing files (only enforce obvious in-repo paths)
const referencedPaths = new Set();
for (const match of reviewMap.matchAll(/`([^`]+)`/g)) {
  const p = match[1];
  if (!p.startsWith('docs/') && !p.startsWith('tools/') && p !== 'review-policy.json' && p !== 'review-input.json' && !p.startsWith('npm ')) {
    continue;
  }
  if (p === 'review-input.json') continue; // created per-run
  if (p.startsWith('npm ')) continue;
  if (p === 'review-policy.json') referencedPaths.add(p);
  if (p.startsWith('docs/') || p.startsWith('tools/')) referencedPaths.add(p);
}
for (const p of referencedPaths) {
  if (!exists(resolveRepo(p))) errors.push(`REVIEW_MAP references missing path: ${p}`);
}

// 5) Doc drift checks: domain tags + readiness labels should match policy in v2 governance docs
const extractBulletValuesUnderHeader = (text, headerRegex) => {
  const headerMatch = text.match(headerRegex);
  if (!headerMatch) return null;
  const start = headerMatch.index + headerMatch[0].length;
  const tail = text.slice(start);
  const lines = tail.split(/\r?\n/);
  const values = [];
  let started = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const m = line.match(/^\s*-\s+`?([a-z0-9_:\- ]+)`?\s*$/i);
    if (m) {
      started = true;
      values.push(m[1].trim());
      continue;
    }
    if (started) {
      // Stop once we've started consuming bullets and we hit a non-bullet line.
      break;
    }
    // Not started yet: allow preamble lines before the first bullet list.
    if (!trimmed) continue;
  }
  return values;
};

const criticalDomains = asStringArray(policy.critical_domains);
const readinessLabels = asStringArray(policy.allowed_readiness_labels);

const domainTagDocsToCheck = [
  'docs/governance/AI_ROLES.md',
  'docs/governance/APPROVAL_THRESHOLDS.md',
  'docs/governance/AUTOPILOT_LOCAL_SPEC.md',
];

for (const rel of domainTagDocsToCheck) {
  const p = resolveRepo(rel);
  if (!exists(p)) {
    warnings.push(`Missing governance doc (skipped drift check): ${rel}`);
    continue;
  }
  const t = readText(p);
  const extracted = extractBulletValuesUnderHeader(t, /###\s+Domain tags\s+\(authoritative list\)\s*\r?\n/i);
  if (!extracted) {
    errors.push(`Cannot find "Domain tags (authoritative list)" bullet list in ${rel}`);
  } else {
    const docSet = new Set(extracted);
    const policySet = new Set(criticalDomains);
    if (!eqSet(docSet, policySet)) {
      errors.push(`Domain tag drift in ${rel} (doc ≠ policy.critical_domains)`);
    }
  }
}

// Readiness labels are required in the docs that declare readiness schema mapping.
for (const rel of ['docs/governance/AI_ROLES.md', 'docs/governance/APPROVAL_THRESHOLDS.md']) {
  const p = resolveRepo(rel);
  if (!exists(p)) continue;
  const t = readText(p);
  for (const label of readinessLabels) {
    if (!t.includes(label)) errors.push(`Readiness label missing in ${rel}: ${label}`);
  }
}

if (warnings.length) {
  console.log('REVIEW GOVERNANCE VALIDATION: WARNINGS\n');
  for (const w of warnings) console.log(`- ${w}`);
  console.log('');
}

if (errors.length) {
  console.error('REVIEW GOVERNANCE VALIDATION: FAILED\n');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log('REVIEW GOVERNANCE VALIDATION: PASSED');

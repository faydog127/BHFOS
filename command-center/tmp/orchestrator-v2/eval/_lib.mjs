import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export function stableStringify(obj) {
  const seen = new WeakSet();
  function sortValue(value) {
    if (value && typeof value === 'object') {
      if (seen.has(value)) return value;
      seen.add(value);
      if (Array.isArray(value)) return value.map(sortValue);
      const out = {};
      for (const k of Object.keys(value).sort()) out[k] = sortValue(value[k]);
      return out;
    }
    return value;
  }
  return JSON.stringify(sortValue(obj), null, 2) + '\n';
}

export function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, stableStringify(obj), 'utf8');
}

export function writeText(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, 'utf8');
}

export function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

export function loadSchemas(schemasRoot) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const runSummarySchema = readJson(path.join(schemasRoot, 'run_summary_schema_v2.json'));
  const resultSchema = readJson(path.join(schemasRoot, 'result_schema_v2.json'));
  const soakSchema = readJson(path.join(schemasRoot, 'soak_summary_schema_v2.json'));
  const priorSchema = readJson(path.join(schemasRoot, 'prior_run_verdict_schema_v2.json'));
  return {
    ajv,
    validateRunSummary: ajv.compile(runSummarySchema),
    validateResult: ajv.compile(resultSchema),
    validateSoak: ajv.compile(soakSchema),
    validatePrior: ajv.compile(priorSchema),
  };
}

export function validateOne(validateFn, obj, label) {
  const ok = validateFn(obj);
  if (!ok) {
    const errors = (validateFn.errors ?? [])
      .map((e) => `${e.instancePath || '(root)'} ${e.message}`)
      .join('; ');
    throw new Error(`Schema validation failed for ${label}: ${errors}`);
  }
}

export function listMissingArtifacts(bundleDir, artifacts) {
  const missing = [];
  for (const [k, rel] of Object.entries(artifacts ?? {})) {
    if (!rel) continue;
    const abs = path.join(bundleDir, rel);
    if (!exists(abs)) missing.push(rel);
  }
  return missing;
}

export const NON_CORRECTNESS_INVARIANTS = new Set(['artifact_completeness']);

export function hasCorrectnessInvariantFailure(results) {
  for (const r of results) {
    for (const inv of r.invariant_results ?? []) {
      if (!inv || inv.passed !== false) continue;
      if (NON_CORRECTNESS_INVARIANTS.has(inv.name)) continue;
      return true;
    }
  }
  return false;
}


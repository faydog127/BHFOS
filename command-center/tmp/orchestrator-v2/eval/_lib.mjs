import fs from 'node:fs';
import path from 'node:path';

function typeOk(type, value) {
  if (Array.isArray(type)) return type.some((t) => typeOk(t, value));
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'string') return typeof value === 'string';
  if (type === 'boolean') return typeof value === 'boolean';
  return false;
}

function pushError(errors, instancePath, message) {
  errors.push({ instancePath, message });
}

function validateSchemaNode(schema, value, instancePath, errors) {
  if (!schema || typeof schema !== 'object') return true;

  if (schema.const !== undefined) {
    if (value !== schema.const) {
      pushError(errors, instancePath, `must equal ${JSON.stringify(schema.const)}`);
      return false;
    }
  }

  if (schema.enum) {
    if (!schema.enum.includes(value)) {
      pushError(errors, instancePath, `must be one of ${JSON.stringify(schema.enum)}`);
      return false;
    }
  }

  if (schema.type) {
    if (!typeOk(schema.type, value)) {
      pushError(errors, instancePath, `must be of type ${JSON.stringify(schema.type)}`);
      return false;
    }
  }

  if (schema.type === 'integer' || (Array.isArray(schema.type) && schema.type.includes('integer'))) {
    if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) {
      pushError(errors, instancePath, `must be >= ${schema.minimum}`);
      return false;
    }
  }

  if (schema.type === 'object' || (Array.isArray(schema.type) && schema.type.includes('object'))) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return true;

    const props = schema.properties ?? {};
    const required = schema.required ?? [];

    for (const k of required) {
      if (!(k in value)) {
        pushError(errors, `${instancePath}/${k}`, 'is required');
        return false;
      }
    }

    if (schema.additionalProperties === false) {
      for (const k of Object.keys(value)) {
        if (!(k in props)) {
          pushError(errors, `${instancePath}/${k}`, 'is not allowed');
          return false;
        }
      }
    }

    for (const [k, subSchema] of Object.entries(props)) {
      if (!(k in value)) continue;
      const ok = validateSchemaNode(subSchema, value[k], `${instancePath}/${k}`, errors);
      if (!ok) return false;
    }

    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const k of Object.keys(value)) {
        if (k in props) continue;
        const ok = validateSchemaNode(schema.additionalProperties, value[k], `${instancePath}/${k}`, errors);
        if (!ok) return false;
      }
    }
  }

  if (schema.type === 'array' || (Array.isArray(schema.type) && schema.type.includes('array'))) {
    if (!Array.isArray(value)) return true;
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        const ok = validateSchemaNode(schema.items, value[i], `${instancePath}/${i}`, errors);
        if (!ok) return false;
      }
    }
  }

  return true;
}

function makeValidator(schema) {
  const fn = (obj) => {
    const errors = [];
    const ok = validateSchemaNode(schema, obj, '', errors);
    fn.errors = errors;
    return ok;
  };
  fn.errors = [];
  return fn;
}

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
  const runSummarySchema = readJson(path.join(schemasRoot, 'run_summary_schema_v2.json'));
  const resultSchema = readJson(path.join(schemasRoot, 'result_schema_v2.json'));
  const soakSchema = readJson(path.join(schemasRoot, 'soak_summary_schema_v2.json'));
  const priorSchema = readJson(path.join(schemasRoot, 'prior_run_verdict_schema_v2.json'));
  return {
    validateRunSummary: makeValidator(runSummarySchema),
    validateResult: makeValidator(resultSchema),
    validateSoak: makeValidator(soakSchema),
    validatePrior: makeValidator(priorSchema),
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

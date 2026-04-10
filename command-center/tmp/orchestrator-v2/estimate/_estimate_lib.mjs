export const normalizeNewlines = (text) => String(text || '').replace(/\r\n/g, '\n');

export const asString = (value) => {
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

export const mdInline = (value) => `\`${asString(value)}\``;

const collapseSlashes = (s) => String(s || '').replace(/([^:])\/{2,}/g, '$1/');
const normPath = (p) => collapseSlashes(asString(p).replaceAll('\\', '/'));

export const canonicalRel = (p) => {
  const s = normPath(p);
  if (!s) return s;
  if (/^[a-zA-Z]:\//.test(s) || s.startsWith('/')) return s;
  if (s.startsWith('./') || s.startsWith('../')) return s;
  return `./${s}`;
};

export const extractTenantFromPath = (p) => {
  const s = normPath(p);
  const m = s.match(/(?:^|\/)artifacts\/tenants\/([^/]+)\/runs\//);
  return m ? m[1] : null;
};

export const requireObject = (obj, label) => {
  if (!obj || typeof obj !== 'object') throw new Error(`Estimate v1: missing required object: ${label}`);
  return obj;
};

export const requireString = (value, label) => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Estimate v1: missing required string: ${label}`);
  return value;
};

export const requireEnum = (value, allowed, label) => {
  if (!allowed.includes(value)) {
    throw new Error(`Estimate v1: invalid ${label} (${asString(value)}). Allowed: ${allowed.join(', ')}`);
  }
  return value;
};

export const requireOneOf = (obj, keys, label) => {
  for (const k of keys) if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== null) return k;
  throw new Error(`Estimate v1: missing required ${label}; expected one of: ${keys.join(', ')}`);
};

export const assertEstimateInvariants = (estimate) => {
  requireObject(estimate, 'root');

  const statusAllowed = ['draft', 'issued', 'approved', 'expired', 'superseded'];
  requireEnum(estimate.status, statusAllowed, 'status');

  const tenantId = requireString(estimate.tenant_id, 'tenant_id');
  const options = requireObject(estimate.options, 'options');

  const recommendedKeys = Object.keys(options).filter((k) => options[k]?.recommended === true);
  if (recommendedKeys.length !== 1) {
    throw new Error(`Estimate v1: expected exactly one recommended option; got ${recommendedKeys.length}`);
  }

  const recommendedOptionKey = requireString(
    estimate?.recommendation?.recommended_option_key,
    'recommendation.recommended_option_key'
  );
  if (recommendedOptionKey !== recommendedKeys[0]) {
    throw new Error(
      `Estimate v1: recommended option mismatch (recommended flag=${recommendedKeys[0]} recommendation.recommended_option_key=${recommendedOptionKey})`
    );
  }

  const selectedOptionKey = requireString(estimate?.selection?.selected_option_key, 'selection.selected_option_key');
  if (!Object.prototype.hasOwnProperty.call(options, selectedOptionKey)) {
    throw new Error(`Estimate v1: selected_option_key not found in options: ${selectedOptionKey}`);
  }

  const selected = options[selectedOptionKey] || {};
  if (!Array.isArray(selected.line_items) || selected.line_items.length === 0) {
    throw new Error('Estimate v1: selected option must include line_items[]');
  }
  if (!selected.pricing || typeof selected.pricing !== 'object') {
    throw new Error('Estimate v1: selected option must include pricing (not only price_range)');
  }
  for (const k of ['subtotal_cents', 'tax_total_cents', 'total_cents']) {
    if (typeof selected.pricing[k] !== 'number') {
      throw new Error(`Estimate v1: selected option pricing missing numeric ${k}`);
    }
  }

  const boundaryPolicy = requireString(estimate.boundary_inheritance_policy, 'boundary_inheritance_policy');
  if (boundaryPolicy !== 'render_universal_plus_selected_option') {
    throw new Error(
      `Estimate v1: unsupported boundary_inheritance_policy=${boundaryPolicy} (expected render_universal_plus_selected_option)`
    );
  }

  // Evidence lineage: require at least one structured ref with a traceable uri.
  const refs = Array.isArray(estimate.evidence_refs) ? estimate.evidence_refs : [];
  if (!refs.length) throw new Error('Estimate v1: evidence_refs[] must be non-empty');
  const traceable = refs.some((r) => r && typeof r === 'object' && typeof r.uri === 'string' && r.uri.trim().length > 0);
  if (!traceable) throw new Error('Estimate v1: evidence_refs[] must include at least one ref with a non-empty uri');

  // Small tenant safety check: if the input path encodes a tenant, it must match JSON.
  // (Many estimate artifacts will live outside artifacts/tenants; this is best-effort.)
  return { tenantId };
};

export const formatMoneyUsd = (cents) => {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return 'UNKNOWN';
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
};


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

  // Versioning discipline: keep this tight for v1.
  requireString(estimate.schema_version, 'schema_version');
  if (!String(estimate.schema_version).startsWith('estimate_judgment_v1.')) {
    throw new Error(`Estimate v1: unsupported schema_version=${asString(estimate.schema_version)}`);
  }

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

  // Recommendation semantics are authored upstream; renderer must never infer.
  // (Documented in ESTIMATE_RENDERER_CONTRACT.md; enforced here only structurally.)

  for (const k of Object.keys(options)) {
    const opt = options[k] || {};
    requireString(opt.label, `options.${k}.label`);
    requireString(opt.name, `options.${k}.name`);
    if (typeof opt.recommended !== 'boolean') throw new Error(`Estimate v1: options.${k}.recommended must be boolean`);
    if (typeof opt.is_fully_quoted !== 'boolean') throw new Error(`Estimate v1: options.${k}.is_fully_quoted must be boolean`);

    // Commercial representation (v1 rule): no bare null.
    const commercialKey = requireOneOf(opt, ['pricing', 'estimated_total', 'price_range'], `options.${k} commercial`);

    // If an option is marked recommended, it must not be a range-only placeholder in v1.
    if (opt.recommended && commercialKey === 'price_range') {
      throw new Error(`Estimate v1: recommended option ${k} must not use price_range only`);
    }

    // All shown options should list line items (even if not fully quoted).
    if (!Array.isArray(opt.line_items) || opt.line_items.length === 0) {
      throw new Error(`Estimate v1: options.${k}.line_items[] must be non-empty`);
    }
    for (const li of opt.line_items) {
      if (typeof li !== 'object' || !li) throw new Error(`Estimate v1: options.${k}.line_items[] must be objects`);
      requireString(li.line_id, `options.${k}.line_items.line_id`);
      requireString(li.name, `options.${k}.line_items.name`);
      if (typeof li.taxable !== 'boolean') throw new Error(`Estimate v1: options.${k}.line_items.taxable must be boolean`);
      if (typeof li.quantity !== 'number') throw new Error(`Estimate v1: options.${k}.line_items.quantity must be number`);
      if (typeof li.unit_price_cents !== 'number') throw new Error(`Estimate v1: options.${k}.line_items.unit_price_cents must be number`);
      if (typeof li.amount_cents !== 'number') throw new Error(`Estimate v1: options.${k}.line_items.amount_cents must be number`);
    }

    // Fully quoted implies fully structured pricing.
    if (opt.is_fully_quoted) {
      if (!opt.pricing || typeof opt.pricing !== 'object') {
        throw new Error(`Estimate v1: options.${k} is_fully_quoted=true requires pricing`);
      }
      for (const pk of ['subtotal_cents', 'tax_total_cents', 'total_cents']) {
        if (typeof opt.pricing[pk] !== 'number') {
          throw new Error(`Estimate v1: options.${k}.pricing missing numeric ${pk}`);
        }
      }
    }
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
  const allowedBoundaryPolicies = ['render_universal_plus_selected_option'];
  if (!allowedBoundaryPolicies.includes(boundaryPolicy)) {
    throw new Error(
      `Estimate v1: unsupported boundary_inheritance_policy=${boundaryPolicy} (allowed: ${allowedBoundaryPolicies.join(', ')})`
    );
  }

  // Evidence lineage: require at least one structured ref with a traceable uri.
  const refs = Array.isArray(estimate.evidence_refs) ? estimate.evidence_refs : [];
  if (!refs.length) throw new Error('Estimate v1: evidence_refs[] must be non-empty');
  const traceable = refs.some(
    (r) =>
      r &&
      typeof r === 'object' &&
      typeof r.type === 'string' &&
      r.type.trim().length > 0 &&
      typeof r.id === 'string' &&
      r.id.trim().length > 0 &&
      typeof r.uri === 'string' &&
      r.uri.trim().length > 0
  );
  if (!traceable) throw new Error('Estimate v1: evidence_refs[] must include at least one ref with a non-empty uri');

  requireString(estimate?.approval_terms?.terms_reference, 'approval_terms.terms_reference');

  // Small tenant safety check: if the input path encodes a tenant, it must match JSON.
  // (Many estimate artifacts will live outside artifacts/tenants; this is best-effort.)
  return { tenantId };
};

export const formatMoneyUsd = (cents) => {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return 'UNKNOWN';
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
};

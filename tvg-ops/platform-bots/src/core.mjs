import { createHash } from 'node:crypto';

export const SCHEMA_VERSION = 'TVG-PLATFORM-HANDOFF-001-v0.2';
export const BOT_CODE_VERSION = '0.2.0';
export const PREPARED_NOT_DELIVERED = 'PREPARED_NOT_DELIVERED';
export const REJECTED_UNUSABLE = 'REJECTED_UNUSABLE';

export const AUTHORITY = Object.freeze({
  observe: 'A0_OBSERVE',
  prepare: 'A1_PREPARE',
  external_action: 'NONE',
  writes: 'BARRED',
  live_access: 'BARRED',
});

const ALLOWED_OPTIONS = new Set([
  'runTime', 'capturedAt', 'staleAfterMinutes', 'recipient', 'redactKeys',
  'inputOrigin', 'relayedBy', 'supersedes'
]);
const PLACEHOLDERS = new Set(['N/A', 'NA', 'TBD', '-', 'NULL', 'UNKNOWN']);
const BIDI_OR_INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

export function assertAllowedOptions(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }
  for (const key of Object.keys(options)) {
    if (!ALLOWED_OPTIONS.has(key)) throw new Error('OPTION_NOT_ALLOWED:' + key);
  }
  if (options.staleAfterMinutes !== undefined && (!Number.isFinite(options.staleAfterMinutes) || options.staleAfterMinutes < 0)) {
    throw new Error('INVALID_STALE_THRESHOLD');
  }
}

function getPath(record, path) {
  const parts = path.split('.');
  let current = record;
  for (const part of parts) {
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
      return { present: false, value: undefined };
    }
    current = current[part];
  }
  return { present: true, value: current };
}

function missingReason(value, present) {
  if (!present) return 'ABSENT_KEY';
  if (value === undefined) return 'UNDEFINED';
  if (value === null) return 'NULL';
  if (typeof value === 'number' && Number.isNaN(value)) return 'NAN';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 'EMPTY';
    if (PLACEHOLDERS.has(trimmed.toUpperCase())) return 'PLACEHOLDER';
  }
  if (Array.isArray(value) && value.length === 0) return 'EMPTY_CONTAINER';
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return 'EMPTY_CONTAINER';
  return null;
}

function scalarState(value, maxLength = 8192) {
  if (!['string', 'number', 'boolean'].includes(typeof value)) return { ok: false, reason: 'INVALID_TYPE' };
  if (typeof value === 'string' && value.length > maxLength) return { ok: false, reason: 'TOO_LONG' };
  if (typeof value === 'number' && !Number.isFinite(value)) return { ok: false, reason: 'INVALID_NUMBER' };
  return { ok: true };
}

function canonicalComparable(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return stableStringify(value);
}

export function normalizeIdentity(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).replace(BIDI_OR_INVISIBLE, '').trim();
  return text || null;
}

export function collectAliasField(record, aliases, { maxLength = 8192 } = {}) {
  const candidates = [];
  const missing = [];
  for (const key of aliases) {
    const found = getPath(record, key);
    const reason = missingReason(found.value, found.present);
    if (reason) {
      missing.push({ key, reason });
      continue;
    }
    const valid = scalarState(found.value, maxLength);
    if (!valid.ok) {
      candidates.push({ key, state: 'INVALID', reason: valid.reason, raw_hash: sha256(stableStringify(found.value)) });
      continue;
    }
    candidates.push({ key, state: 'KNOWN', value: found.value });
  }

  const known = candidates.filter((c) => c.state === 'KNOWN');
  const invalid = candidates.filter((c) => c.state === 'INVALID');
  if (known.length === 0) {
    if (invalid.length) return { state: 'INVALID', candidates: invalid, missing };
    return { state: 'UNKNOWN', reason: missing[0]?.reason ?? 'ABSENT_KEY', missing };
  }

  const distinct = new Map();
  for (const item of known) distinct.set(stableStringify(canonicalComparable(item.value)), item);
  if (distinct.size > 1) {
    return { state: 'CONFLICT', candidates: known, missing };
  }
  return { state: 'KNOWN', value: known[0].value, source_key: known[0].key, aliases_seen: known.map((x) => x.key), missing };
}

export function parseIsoWithZone(value) {
  if (typeof value !== 'string') return { state: 'INVALID', reason: 'DATE_NOT_STRING' };
  const text = value.trim();
  const zoned = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!zoned.test(text)) return { state: 'INVALID', reason: 'DATE_ZONE_REQUIRED' };
  const d = new Date(text);
  if (Number.isNaN(d.valueOf())) return { state: 'INVALID', reason: 'INVALID_DATE' };
  return { state: 'KNOWN', value: d.toISOString() };
}

export function normalizeBooleanField(field) {
  if (field.state !== 'KNOWN') return field;
  const v = field.value;
  if (typeof v === 'boolean') return { ...field, value: v };
  if (typeof v === 'number' && (v === 0 || v === 1)) return { ...field, value: Boolean(v) };
  if (typeof v === 'string') {
    const t = v.trim().toUpperCase();
    if (['TRUE', 'YES', 'Y', '1'].includes(t)) return { ...field, value: true };
    if (['FALSE', 'NO', 'N', '0'].includes(t)) return { ...field, value: false };
  }
  return { state: 'INVALID', reason: 'INVALID_BOOLEAN', source_key: field.source_key, raw_hash: sha256(stableStringify(v)) };
}

export function normalizeDateField(field) {
  if (field.state !== 'KNOWN') return field;
  const parsed = parseIsoWithZone(field.value);
  if (parsed.state !== 'KNOWN') return { ...parsed, source_key: field.source_key, raw_hash: sha256(stableStringify(field.value)) };
  return { ...field, value: parsed.value };
}

export function quoteUntrustedText(field, maxLength = 4096) {
  if (field.state !== 'KNOWN') return field;
  if (typeof field.value !== 'string') return { state: 'INVALID', reason: 'UNTRUSTED_TEXT_NOT_STRING', source_key: field.source_key };
  const raw = field.value;
  if (raw.length > maxLength) return { state: 'INVALID', reason: 'TOO_LONG', source_key: field.source_key, raw_hash: sha256(raw) };
  const flags = [];
  if (BIDI_OR_INVISIBLE.test(raw)) flags.push('BIDI_OR_INVISIBLE');
  BIDI_OR_INVISIBLE.lastIndex = 0;
  if (CONTROL_CHARS.test(raw)) flags.push('CONTROL_CHAR');
  CONTROL_CHARS.lastIndex = 0;
  const quoted = raw
    .replace(BIDI_OR_INVISIBLE, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
    .replace(CONTROL_CHARS, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return { state: 'KNOWN', quoted_value: quoted, source_key: field.source_key, raw_hash: sha256(raw), flags };
}

export function computeFreshness({ recordUpdatedAt, capturedAt, runTime, staleAfterMinutes }) {
  const run = parseIsoWithZone(runTime);
  const captured = parseIsoWithZone(capturedAt);
  const record = recordUpdatedAt?.state === 'KNOWN' ? parseIsoWithZone(recordUpdatedAt.value) : { state: 'UNKNOWN' };
  if (run.state !== 'KNOWN') throw new Error('RUN_TIME_INVALID');
  if (captured.state !== 'KNOWN') return { state: 'UNKNOWN', capture_state: 'UNKNOWN', record_state: record.state };

  const runMs = new Date(run.value).valueOf();
  const capMs = new Date(captured.value).valueOf();
  const captureAge = (runMs - capMs) / 60000;
  const out = {
    state: 'UNKNOWN',
    capture_state: 'UNKNOWN',
    record_state: record.state,
    capture_age_minutes: Number(captureAge.toFixed(3)),
    record_age_minutes: 'UNKNOWN',
    stale_after_minutes: Number.isFinite(staleAfterMinutes) ? staleAfterMinutes : 'UNKNOWN',
    valid_until: 'UNKNOWN',
  };

  if (captureAge < 0) {
    out.state = out.capture_state = 'FUTURE_DATED';
  } else if (Number.isFinite(staleAfterMinutes)) {
    out.capture_state = captureAge < staleAfterMinutes ? 'FRESH' : 'STALE';
    out.state = out.capture_state;
    out.valid_until = new Date(capMs + staleAfterMinutes * 60000).toISOString();
  }

  if (record.state === 'KNOWN') {
    const recMs = new Date(record.value).valueOf();
    const recordAge = (runMs - recMs) / 60000;
    out.record_age_minutes = Number(recordAge.toFixed(3));
    out.record_state = recordAge < 0 ? 'FUTURE_DATED' : 'OBSERVED';
  }
  return out;
}

export function normalizeRedactKeys(redactKeys = []) {
  return new Set(redactKeys.map((x) => String(x).toLowerCase()));
}

export function recursivelyRedact(record, redactKeys = []) {
  const configured = normalizeRedactKeys(redactKeys);
  const defaults = new Set([
    'street_address', 'address_line_1', 'address_line_2', 'ssn', 'dob', 'tax_id',
    'bank_account', 'routing_number', 'password', 'token', 'api_key', 'authorization',
    'phone', 'email', 'lockbox_code', 'gate_code'
  ]);
  const keys = new Set([...defaults, ...configured]);
  const redactedFields = [];
  const seen = new WeakSet();
  function walk(value, path = '') {
    if (value && typeof value === 'object') {
      if (seen.has(value)) return '[CYCLIC_REDACTED]';
      seen.add(value);
      if (Array.isArray(value)) return value.map((v, i) => walk(v, path + '[' + i + ']'));
      const out = {};
      for (const [key, child] of Object.entries(value)) {
        const next = path ? path + '.' + key : key;
        if (keys.has(key.toLowerCase())) {
          redactedFields.push(next);
          out[key] = null;
        } else out[key] = walk(child, next);
      }
      return out;
    }
    return value;
  }
  return { record: walk(record), redacted_fields: redactedFields.sort() };
}

export function listUnmappedTopLevelKeys(record, contract) {
  const topLevel = new Set();
  for (const aliases of Object.values(contract.fields)) {
    for (const alias of aliases) topLevel.add(alias.split('.')[0]);
  }
  return Object.keys(record).filter((key) => !topLevel.has(key)).sort();
}

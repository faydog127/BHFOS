export const UNKNOWN = 'UNKNOWN';
export const PREPARED_NOT_DELIVERED = 'PREPARED_NOT_DELIVERED';

export const AUTHORITY = Object.freeze({
  observe: 'A0_OBSERVE',
  prepare: 'A1_PREPARE',
  externalAction: 'NONE',
  writes: 'BARRED',
  liveAccess: 'BARRED',
});

const DEFAULT_REDACT_KEYS = new Set([
  'street_address', 'address_line_1', 'address_line_2', 'ssn', 'dob',
  'license_number', 'tax_id', 'bank_account', 'routing_number'
]);

export function firstPresent(record, aliases = []) {
  for (const key of aliases) {
    if (Object.prototype.hasOwnProperty.call(record, key) && record[key] !== null && record[key] !== '') {
      return { value: record[key], key };
    }
  }
  return { value: UNKNOWN, key: null };
}

export function safeIso(value) {
  if (!value || value === UNKNOWN) return UNKNOWN;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? UNKNOWN : date.toISOString();
}

export function computeFreshness({ sourceAsOf, runTime, staleAfterMinutes }) {
  if (!Number.isFinite(staleAfterMinutes)) return { state: UNKNOWN, ageMinutes: UNKNOWN };
  const source = new Date(sourceAsOf);
  const run = new Date(runTime);
  if (Number.isNaN(source.valueOf()) || Number.isNaN(run.valueOf())) {
    return { state: UNKNOWN, ageMinutes: UNKNOWN };
  }
  const ageMinutes = Math.floor((run - source) / 60000);
  return { state: ageMinutes <= staleAfterMinutes ? 'FRESH' : 'STALE', ageMinutes };
}

export function minimizeRecord(record, redactKeys = []) {
  const keys = new Set([...DEFAULT_REDACT_KEYS, ...redactKeys]);
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [
    key,
    keys.has(key.toLowerCase()) && value !== null && value !== '' ? '[REDACTED]' : value,
  ]));
}

export function normalizeWithContract(raw, contract) {
  const data = {};
  const provenance = {};
  const missing = [];
  for (const [field, aliases] of Object.entries(contract.fields)) {
    const found = firstPresent(raw, aliases);
    data[field] = found.value;
    provenance[field] = found.key ?? UNKNOWN;
    if (found.value === UNKNOWN) missing.push(field);
  }
  return { data, provenance, missing };
}

export function assertPrepareOnly(options = {}) {
  const forbidden = ['token', 'apiKey', 'auth', 'baseUrl', 'client', 'write', 'send', 'submit'];
  for (const key of forbidden) {
    if (options[key]) throw new Error(`LIVE_OR_WRITE_PATH_BARRED:${key}`);
  }
}

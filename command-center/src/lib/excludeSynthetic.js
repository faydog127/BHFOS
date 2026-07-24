/**
 * UX-POLISH — shared synthetic / test-row exclusion (PD-UXP-03 A).
 * Live mode: hide is_test_data + known synth identity patterns.
 * Training mode callers should skip client pattern filter when query already
 * restricts to is_test_data=true.
 */

const SYNTH_EMAIL_RE =
  /@(?:example\.(?:com|invalid)|vent-guys\.test|bhfos\.test)\b/i;
const SYNTH_NAME_RE =
  /\b(?:synth(?:etic)?|aexec\d*|uat\b|nombre falso|test recipient|pdf customer|tvg release synthetic|do not contact|unnamed lead)\b/i;
const SYNTH_ID_FRAGMENT_RE = /^(?:no email\s*)?\d{10,}$/i;

export function identityBlob(record = {}) {
  const lead = record.lead || record.leads || {};
  const parts = [
    record.is_test_data,
    record.email,
    record.company,
    record.first_name,
    record.last_name,
    record.name,
    record.title,
    record.subtitle,
    record.customer_name,
    record.job_number,
    record.service_address,
    lead.email,
    lead.company,
    lead.first_name,
    lead.last_name,
  ];
  return parts
    .filter((v) => v != null && v !== '')
    .map((v) => String(v))
    .join(' ');
}

/** True when row should be treated as synthetic/test for live surfaces. */
export function isSynthetic(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.is_test_data === true) return true;
  // UXV2: honor is_legacy when already present on fetched rows (no migration).
  if (record.is_legacy === true) return true;

  const email = String(record.email || record.lead?.email || record.leads?.email || '');
  if (email && SYNTH_EMAIL_RE.test(email)) return true;

  const blob = identityBlob(record);
  if (SYNTH_NAME_RE.test(blob)) return true;

  const bareName = String(record.first_name || record.name || '').trim();
  if (bareName && SYNTH_ID_FRAGMENT_RE.test(bareName)) return true;

  return false;
}

/** Filter arrays for live KPI/list rendering (after fetch). */
export function excludeSyntheticRows(rows, { trainingMode = false } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (trainingMode) {
    return list.filter((row) => row?.is_test_data === true || isSynthetic(row));
  }
  return list.filter((row) => !isSynthetic(row));
}

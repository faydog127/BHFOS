/**
 * ML-P1 Slice 5 — client authz helpers for invoice actions.
 */

export const ML_P1_S5_CAPABILITIES = {
  create: ['office', 'manager', 'admin', 'csr'],
  draftUpdate: ['office', 'manager', 'admin', 'csr'],
  issue: ['office', 'manager', 'admin', 'csr'],
  void: ['office', 'manager', 'admin', 'csr'],
  writeOff: ['admin'],
};

export function normalizeS5Role(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'csr') return 'office';
  return r || 'unauthenticated';
}

export function canPerformS5(role, capability) {
  const allowed = ML_P1_S5_CAPABILITIES[capability] || [];
  const r = normalizeS5Role(role);
  return allowed.includes(r) || (r === 'office' && allowed.includes('csr'));
}

export function formatInvoiceStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'sent') return 'Issued';
  if (s === 'draft') return 'Draft';
  if (s === 'void') return 'Void';
  if (s === 'paid') return 'Paid';
  if (s === 'partial' || s === 'partially_paid') return 'Partially paid';
  return status || 'Unknown';
}

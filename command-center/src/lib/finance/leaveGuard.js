/**
 * Finance leave decisions.
 * A path under /:tenant/finance keeps the in-memory draft.
 * Any other same-origin path asks Cancel or Discard and does not save.
 */

export function financePrefix(tenantId) {
  return `/${tenantId}/finance`;
}

export function isFinanceLocation(pathname, tenantId) {
  if (!pathname || !tenantId) return false;
  const prefix = financePrefix(tenantId);
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function leaveDisposition(pathname, tenantId) {
  return isFinanceLocation(pathname, tenantId) ? 'retain' : 'prompt';
}

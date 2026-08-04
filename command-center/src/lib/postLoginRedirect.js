/**
 * Safe post-login / OAuth redirect helpers for CRM + MIL product paths.
 * Client-side routing only — not authorization.
 */

export const PENDING_POST_LOGIN_PATH_KEY = 'pending_post_login_path';
export const POST_OAUTH_REDIRECT_KEY = 'post_oauth_redirect';

export function isSafeMilPostLoginPath(next) {
  return (
    typeof next === 'string' &&
    (next.startsWith('/media') ||
      next.startsWith('/creator') ||
      next.startsWith('/contributor') ||
      next === '/uploads' ||
      next === '/all' ||
      next === '/review' ||
      next.startsWith('/uploads?') ||
      next.startsWith('/all?') ||
      next.startsWith('/review?'))
  );
}

export function isSafeTenantPostLoginPath(next, tenantId = 'tvg') {
  const tenant = String(tenantId || 'tvg').toLowerCase();
  return typeof next === 'string' && next.startsWith(`/${tenant}/`);
}

export function isSafePostLoginPath(next, tenantId = 'tvg') {
  return isSafeMilPostLoginPath(next) || isSafeTenantPostLoginPath(next, tenantId);
}

export function decodeNextParam(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Normalize and accept only safe internal destinations. */
export function sanitizePostLoginPath(raw, tenantId = 'tvg') {
  const next = decodeNextParam(raw);
  if (!next || !next.startsWith('/')) return null;
  if (next.startsWith('//')) return null;
  return isSafePostLoginPath(next, tenantId) ? next : null;
}

export function isCrmHubPath(path, tenantId = 'tvg') {
  const tenant = String(tenantId || 'tvg').toLowerCase();
  if (typeof path !== 'string') return false;
  return path === `/${tenant}/crm` || path === `/${tenant}/crm/`;
}

export function setPendingPostLoginPath(path) {
  try {
    if (path) sessionStorage.setItem(PENDING_POST_LOGIN_PATH_KEY, path);
    else sessionStorage.removeItem(PENDING_POST_LOGIN_PATH_KEY);
  } catch {
    // private mode / blocked storage
  }
}

export function getPendingPostLoginPath() {
  try {
    return sessionStorage.getItem(PENDING_POST_LOGIN_PATH_KEY);
  } catch {
    return null;
  }
}

export function clearPendingPostLoginPath() {
  try {
    sessionStorage.removeItem(PENDING_POST_LOGIN_PATH_KEY);
  } catch {
    // ignore
  }
}

/**
 * Resolve where Google OAuth should return the user after RootGate exchange.
 * Prefers ?next=, then pending sessionStorage, else tenant CRM.
 */
export function resolveOAuthDesiredPath({
  locationSearch = '',
  tenantId = 'tvg',
  pendingPath = null,
} = {}) {
  const tenant = String(tenantId || 'tvg').toLowerCase();
  const params = new URLSearchParams(
    typeof locationSearch === 'string' ? locationSearch.replace(/^\?/, '') : ''
  );
  const fromQuery = sanitizePostLoginPath(params.get('next'), tenant);
  if (fromQuery) return fromQuery;
  const fromPending = sanitizePostLoginPath(pendingPath ?? getPendingPostLoginPath(), tenant);
  if (fromPending) return fromPending;
  return `/${tenant}/crm`;
}

export function passwordResetRedirectTo(origin, tenantId = 'tvg') {
  const tenant = String(tenantId || 'tvg').toLowerCase();
  const base = String(origin || '').replace(/\/$/, '');
  return `${base}/${tenant}/reset-password`;
}

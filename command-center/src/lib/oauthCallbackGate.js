/**
 * RootGate OAuth return routing.
 *
 * Do not navigate away while an OAuth `code` (or token) is still present and
 * the session is not ready yet. Leaving `/?code=...` for `/select-tenant`
 * drops the PKCE callback query and can abort a slow exchange — observed on
 * iOS Safari as a failed "Continue with Google" that lands on select-tenant.
 */

export const OAUTH_CALLBACK_MAX_WAIT_MS = 12000;

/**
 * @param {object} input
 * @param {boolean} input.hasOAuthParams
 * @param {object|null|undefined} input.session
 * @param {string|null|undefined} input.oauthError
 * @param {string|null|undefined} input.oauthErrorDescription
 * @param {number} input.waitedMs
 * @param {number} [input.maxWaitMs]
 * @param {string|null|undefined} input.postLoginRedirect
 * @param {string} [input.tenantFallback]
 * @returns {{ action: 'wait'|'navigate'|'fail', to?: string, replace?: boolean, clearPostLoginRedirect?: boolean, message?: string }}
 */
export function resolveOAuthCallbackNavigation({
  hasOAuthParams,
  session,
  oauthError = null,
  oauthErrorDescription = null,
  waitedMs = 0,
  maxWaitMs = OAUTH_CALLBACK_MAX_WAIT_MS,
  postLoginRedirect = null,
  tenantFallback = 'tvg',
}) {
  const tenant = String(tenantFallback || 'tvg').toLowerCase();

  if (!hasOAuthParams) {
    if (session) {
      return { action: 'navigate', to: `/${tenant}/crm`, replace: true };
    }
    return { action: 'navigate', to: '/select-tenant', replace: true };
  }

  if (session) {
    return {
      action: 'navigate',
      to: postLoginRedirect || `/${tenant}/crm`,
      replace: true,
      clearPostLoginRedirect: true,
    };
  }

  if (oauthError) {
    return {
      action: 'fail',
      message:
        oauthErrorDescription ||
        oauthError ||
        'Sign-in was cancelled or failed.',
      to: `/${tenant}/login`,
      replace: true,
    };
  }

  if (waitedMs < maxWaitMs) {
    return { action: 'wait' };
  }

  return {
    action: 'fail',
    message: 'Sign-in did not complete. Please try again with Continue with Google, or use email and password.',
    to: `/${tenant}/login`,
    replace: true,
  };
}

/**
 * True when the current URL still carries an OAuth callback payload.
 * Checks query string and hash (implicit/token style).
 */
export function urlHasOAuthCallbackParams(search = '', hash = '') {
  const query = new URLSearchParams(typeof search === 'string' ? search : '');
  const hashQuery = new URLSearchParams(
    typeof hash === 'string' ? hash.replace(/^#/, '') : ''
  );

  const keys = ['code', 'access_token', 'refresh_token', 'error', 'error_description'];
  return keys.some((key) => query.has(key) || hashQuery.has(key));
}

export function readOAuthErrorFromUrl(search = '', hash = '') {
  const query = new URLSearchParams(typeof search === 'string' ? search : '');
  const hashQuery = new URLSearchParams(
    typeof hash === 'string' ? hash.replace(/^#/, '') : ''
  );
  const oauthError = query.get('error') || hashQuery.get('error');
  const oauthErrorDescription =
    query.get('error_description') || hashQuery.get('error_description');
  return { oauthError, oauthErrorDescription };
}

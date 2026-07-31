/**
 * Explicit OAuth return recovery for hash tokens and PKCE codes.
 *
 * detectSessionInUrl can race with RootGate's wait window; calling this on
 * init (and once while waiting) materializes the session before we fail.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient['auth']} auth
 * @param {{ search?: string, hash?: string }} [loc]
 * @returns {Promise<{ session: object|null, error: Error|null, recovered: boolean }>}
 */
export async function recoverOAuthSessionFromUrl(auth, loc = {}) {
  if (!auth || typeof auth.setSession !== 'function') {
    return { session: null, error: new Error('Auth client unavailable'), recovered: false };
  }

  const search = typeof loc.search === 'string' ? loc.search : '';
  const hash = typeof loc.hash === 'string' ? loc.hash : '';
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const hashQuery = new URLSearchParams(hash.replace(/^#/, ''));

  const oauthError = query.get('error') || hashQuery.get('error');
  if (oauthError) {
    const description =
      query.get('error_description') || hashQuery.get('error_description') || oauthError;
    return { session: null, error: new Error(description), recovered: false };
  }

  const code = query.get('code');
  if (code && typeof auth.exchangeCodeForSession === 'function') {
    const { data, error } = await auth.exchangeCodeForSession(code);
    if (error) return { session: null, error, recovered: false };
    return { session: data?.session ?? null, error: null, recovered: Boolean(data?.session) };
  }

  const access_token = hashQuery.get('access_token') || query.get('access_token');
  const refresh_token = hashQuery.get('refresh_token') || query.get('refresh_token');
  if (access_token && refresh_token) {
    const { data, error } = await auth.setSession({ access_token, refresh_token });
    if (error) return { session: null, error, recovered: false };
    return { session: data?.session ?? null, error: null, recovered: Boolean(data?.session) };
  }

  if (access_token && !refresh_token) {
    return {
      session: null,
      error: new Error(
        'Sign-in return was incomplete (missing refresh token). Try email and password, or Continue with Google again.',
      ),
      recovered: false,
    };
  }

  return { session: null, error: null, recovered: false };
}

/** Strip OAuth payload from the address bar after a successful recovery. */
export function clearOAuthParamsFromLocation() {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  ['code', 'access_token', 'refresh_token', 'expires_in', 'token_type', 'type', 'provider_token', 'provider_refresh_token', 'error', 'error_description'].forEach(
    (key) => {
      url.searchParams.delete(key);
    },
  );
  url.hash = '';
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
}

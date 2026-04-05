import { createClient } from '@supabase/supabase-js';
import {
  hasHostedLocalSupabaseMismatch,
  hostedLocalSupabaseErrorMessage,
  isLocalSupabaseProject,
  isLocalSupabaseUrl,
  supabaseAnonKey,
  supabaseUrl,
} from './supabaseEnv';

/**
 * Base64 decode helper that works in browser + node-like contexts.
 */
const decodeBase64 = (value) => {
  try {
    if (typeof atob === 'function') return atob(value);
    // eslint-disable-next-line no-undef
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return null;
  }
};

/**
 * Protect against accidentally shipping service_role in the browser.
 */
const assertNotServiceRoleKey = (key) => {
  if (!key) throw new Error('Missing VITE_SUPABASE_ANON_KEY.');

  const parts = key.split('.');
  if (parts.length !== 3) return;

  const payload = decodeBase64(parts[1]);
  if (!payload) return;

  try {
    const data = JSON.parse(payload);
    if (data?.role === 'service_role') {
      throw new Error(
        'SECURITY: Supabase service role key detected in client env. Use anon key only.'
      );
    }
  } catch (error) {
    // Only rethrow our security error
    if (error instanceof Error && error.message.includes('SECURITY:')) throw error;
  }
};

assertNotServiceRoleKey(supabaseAnonKey);

/**
 * Use localStorage explicitly (browser). Provide a safe fallback for environments
 * where localStorage is unavailable (rare, but possible).
 */
const storage =
  typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
      };

/**
 * Create a SINGLE supabase client instance with explicit auth settings.
 * This prevents “expired token keeps being reused” behavior.
 */
const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage
  }
});

/**
 * Nudge token refresh when returning to the tab.
 * Helps if the app sits idle long enough for the access token to expire.
 */
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;

    try {
      const { data } = await customSupabaseClient.auth.getSession();
      const session = data?.session;

      // If there's no session, nothing to refresh.
      if (!session) return;

      // If token is close to expiring (or already expired), refresh.
      const expMs = (session.expires_at ?? 0) * 1000;
      const nowMs = Date.now();
      const fiveMinutesMs = 5 * 60 * 1000;

      if (!expMs || expMs - nowMs < fiveMinutesMs) {
        await customSupabaseClient.auth.refreshSession();
      }
    } catch {
      // Silent: avoid loops/toasts just from tab focus.
    }
  });
}

export default customSupabaseClient;

export {
  customSupabaseClient,
  customSupabaseClient as supabase,
  hasHostedLocalSupabaseMismatch,
  hostedLocalSupabaseErrorMessage,
  isLocalSupabaseProject,
  isLocalSupabaseUrl,
  supabaseAnonKey,
  supabaseUrl,
};

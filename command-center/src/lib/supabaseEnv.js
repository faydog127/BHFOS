const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const LOCAL_SUPABASE_HOST_RE = /(?:^|\/\/)(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?/i;
const LOCAL_BROWSER_HOST_RE = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i;
const LOCAL_BROWSER_SUFFIX_RE = /\.local$/i;

export const isLocalSupabaseUrl = (value = rawSupabaseUrl) =>
  typeof value === 'string' && LOCAL_SUPABASE_HOST_RE.test(value);

export const isLocalBrowserHost = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;

  const hostname = value.trim().replace(/^\[|\]$/g, '');
  return LOCAL_BROWSER_HOST_RE.test(hostname) || LOCAL_BROWSER_SUFFIX_RE.test(hostname);
};

export const supabaseUrl = rawSupabaseUrl;
export const supabaseAnonKey = rawSupabaseAnonKey;
export const isLocalSupabaseProject = isLocalSupabaseUrl(rawSupabaseUrl);

const browserHostname =
  typeof window !== 'undefined' ? String(window.location?.hostname || '') : '';

export const hasHostedLocalSupabaseMismatch =
  typeof window !== 'undefined' &&
  !isLocalBrowserHost(browserHostname) &&
  isLocalSupabaseProject;

export const hostedLocalSupabaseErrorMessage =
  'This deployment was built with local Supabase settings. Rebuild with npm run build and redeploy.';

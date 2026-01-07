import { supabase } from '@/lib/customSupabaseClient';
import brandConfig from '@/config/brand.config.json';
import { jwtDecode } from "jwt-decode";

// --- Token & Session Management ---

const getAccessToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

/**
 * Logs debug information about the tenant ID extracted from the current user's JWT.
 * @returns {string|null} The tenant ID from the token, or null if not found.
 */
export const logTenantDebugInfo = async () => {
  try {
    const token = await getAccessToken();
    if (!token) {
      console.log('TenantDebug: No active session/token found.');
      return null;
    }

    const decoded = jwtDecode(token);
    const tenantId = decoded.app_metadata?.tenant_id;
    
    console.group('Tenant Resolution Debug');
    console.log('Decoded Token:', decoded);
    console.log('App Metadata Tenant ID:', tenantId);
    console.groupEnd();

    return tenantId;
  } catch (error) {
    console.error('TenantDebug: Error decoding token:', error);
    return null;
  }
};

/**
 * Resolves the tenant ID from the current Supabase session's access token.
 * This is the authoritative source for the authenticated user's tenant.
 * @returns {string|null} The tenant ID from the session, or null if not available.
 */
export const resolveTenantIdFromSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return null;
    }

    const token = session.access_token;
    const decoded = jwtDecode(token);
    const claimTenantId = decoded.app_metadata?.tenant_id;

    return claimTenantId || null;
  } catch (err) {
    console.error('TenantResolver: Unexpected error while resolving tenant from session', err);
    return null;
  }
};

/**
 * Retrieves the configuration for a given tenant ID. Defaults to 'tvg' if not found.
 * @param {string} [tenantId='tvg'] - The tenant ID to retrieve configuration for.
 * @returns {object} The tenant's brand configuration.
 */
export const getTenantConfig = (tenantId = 'tvg') => {
  return brandConfig[tenantId] || brandConfig['tvg']; 
};

// --- URL & Path Helpers ---

/**
 * Extracts the tenant ID from the current window.location.pathname.
 * It assumes the tenant ID is the first segment of the path (e.g., /:tenantId/crm/dashboard).
 * @returns {string|null} The tenant ID from the URL path, or null if not found.
 */
export const getTenantIdFromUrl = () => {
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean); // Filters out empty strings from split

  if (segments.length === 0) {
    return null; 
  }
  
  // The first segment is assumed to be the tenant ID
  return segments[0].toLowerCase();
};

// Alias for backward compatibility to fix import errors
export const getUrlTenant = getTenantIdFromUrl;

/**
 * Retrieves the currently selected tenant ID, prioritizing the URL path,
 * then falling back to localStorage, and finally returning null if neither exists.
 * @returns {string|null} The selected tenant ID.
 */
export const getSelectedTenantId = () => {
  const urlTenant = getTenantIdFromUrl();
  if (urlTenant) {
    return urlTenant;
  }

  const localStorageTenant = localStorage.getItem('currentTenantId');
  if (localStorageTenant) {
    return localStorageTenant;
  }

  return null;
};

/**
 * Stores the provided tenantId in localStorage under the key 'currentTenantId'.
 * @param {string} tenantId - The tenant ID to store.
 */
export const setSelectedTenantId = (tenantId) => {
  if (tenantId) {
    localStorage.setItem('currentTenantId', tenantId);
  } else {
    localStorage.removeItem('currentTenantId');
  }
};

/**
 * Asserts whether the selected tenant ID (from URL/localStorage) matches the tenant ID
 * extracted from the user's authentication token. Logs a warning if they differ.
 * @param {string|null} selectedTenantId - The tenant ID obtained from URL or localStorage.
 * @param {string|null} tokenTenantId - The tenant ID obtained from the authenticated user's JWT.
 * @returns {boolean} True if the tenant IDs match or both are null, false otherwise.
 */
export const assertTenantMatch = (selectedTenantId, tokenTenantId) => {
  if (selectedTenantId === tokenTenantId) {
    return true;
  } else {
    console.warn(
      `Tenant Mismatch Detected: Selected Tenant ID (${selectedTenantId}) does not match ` +
      `Token Tenant ID (${tokenTenantId}). This might indicate a routing or authentication issue.`
    );
    return false;
  }
};

/**
 * Helper to get the current tenant ID from URL or fallback to a default 'tvg'.
 * This function is primarily for convenience where a non-null tenant is always expected.
 * For more robust checks, use getSelectedTenantId() and assertTenantMatch().
 * @returns {string} The resolved tenant ID, defaulting to 'tvg'.
 */
export const getTenantId = () => {
  return getTenantIdFromUrl() || 'tvg';
};

/**
 * Ensures a path is prefixed with the current tenant.
 * Uses the provided tenant or derives it from the URL if not provided.
 * 
 * Usage: tenantPath('/crm/dashboard', 'demo') -> '/demo/crm/dashboard'
 * @param {string} path - The path to prefix with the tenant ID.
 * @param {string|null} [currentTenant=null] - An optional tenant ID to use. If not provided, it's derived from the URL.
 * @returns {string} The tenant-prefixed path.
 */
export const tenantPath = (path, currentTenant = null) => {
  const tenant = currentTenant || getTenantIdFromUrl() || 'tvg';
  
  // Remove leading slash for consistency
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  // If the path already starts with the tenant, return as is
  if (cleanPath.startsWith(`${tenant}/`)) {
    return `/${cleanPath}`;
  }
  
  return `/${tenant}/${cleanPath}`;
};
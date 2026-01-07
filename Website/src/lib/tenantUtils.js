
import { supabase } from '@/lib/customSupabaseClient';
import brandConfig from '@/config/brand.config.json';
import { jwtDecode } from "jwt-decode";

// --- Token & Session Management ---

const getAccessToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

export const logTenantDebugInfo = async () => {
  try {
    const token = await getAccessToken();
    if (!token) {
      console.log('TenantDebug: No active session/token found.');
      return;
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
  }
};

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
    console.error('TenantResolver: Unexpected error', err);
    return null;
  }
};

export const getTenantConfig = (tenantId = 'tvg') => {
  return brandConfig[tenantId] || brandConfig['tvg']; 
};

// --- URL & Path Helpers ---

/**
 * Extracts the tenant ID from the current window location.
 * Strictly relies on the first path segment.
 * 
 * @returns {string|null} The tenant ID or null if not found/root.
 */
export const getUrlTenant = () => {
  const path = window.location.pathname;
  // Split path by '/', filter empty strings (caused by leading slash)
  const segments = path.split('/').filter(Boolean);
  
  if (segments.length === 0) {
    return null; 
  }
  
  // First segment is the tenant
  return segments[0].toLowerCase();
};

/**
 * Helper to get the current tenant ID from URL or fallback.
 * Used by components to get context.
 */
export const getTenantId = () => {
  return getUrlTenant() || 'tvg';
};

/**
 * Ensures a path is prefixed with the current tenant.
 * Uses the provided tenant or derives it from the URL if not provided.
 * 
 * Usage: tenantPath('/crm/dashboard', 'demo') -> '/demo/crm/dashboard'
 */
export const tenantPath = (path, currentTenant = null) => {
  // If no tenant provided, try to get from URL, fallback to 'tvg' (default) if absolutely necessary context missing
  const tenant = currentTenant || getUrlTenant() || 'tvg';
  
  // Remove leading slash for consistency
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  // If the path already starts with the tenant, return as is
  if (cleanPath.startsWith(`${tenant}/`)) {
    return `/${cleanPath}`;
  }
  
  return `/${tenant}/${cleanPath}`;
};

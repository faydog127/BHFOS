/**
 * Finance authorization for Steps 1–6.
 * Role and tenant come only from the JWT app_metadata claims.
 * owner is denied. Editable profile claims and localStorage are not authorities.
 * The route tenant must equal tvg, and a route param cannot grant access by itself.
 */
import { jwtDecode } from 'jwt-decode';

export const FINANCE_CAPABILITIES = Object.freeze({
  READ: 'finance.plan.read',
  WRITE: 'finance.plan.write',
});

export const FINANCE_ALLOWED_ROLES = Object.freeze(['admin', 'super_admin']);

export const FINANCE_ROUTE_TENANT = 'tvg';

export function readAppMetadataClaims(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') return null;
  try {
    const decoded = jwtDecode(accessToken);
    const appMetadata = decoded && decoded.app_metadata;
    if (!appMetadata || typeof appMetadata !== 'object') {
      return { role: null, tenantId: null };
    }
    const role = typeof appMetadata.role === 'string' ? appMetadata.role.trim().toLowerCase() : null;
    const tenantId = typeof appMetadata.tenant_id === 'string' ? appMetadata.tenant_id.trim().toLowerCase() : null;
    return { role, tenantId };
  } catch {
    return null;
  }
}

/**
 * finance.plan.read and finance.plan.write both require normalized admin.
 * This slice does not map owner or any other alias onto admin.
 * There is no write path in Steps 1–6; write is defined so the capability exists.
 */
export function roleHasFinanceCapability(role, capability) {
  if (capability !== FINANCE_CAPABILITIES.READ && capability !== FINANCE_CAPABILITIES.WRITE) return false;
  if (role === 'admin' || role === 'super_admin') return true;
  return false;
}

export function evaluateFinanceAccess({ accessToken, routeTenantId }) {
  const claims = readAppMetadataClaims(accessToken);
  if (!claims) {
    return { allowed: false, reason: 'unauthenticated', role: null, sessionTenantId: null };
  }
  const routeTenant = typeof routeTenantId === 'string' ? routeTenantId.trim().toLowerCase() : '';
  if (routeTenant !== FINANCE_ROUTE_TENANT) {
    return { allowed: false, reason: 'route_tenant', role: claims.role, sessionTenantId: claims.tenantId };
  }
  if (claims.tenantId !== FINANCE_ROUTE_TENANT) {
    return { allowed: false, reason: 'session_tenant', role: claims.role, sessionTenantId: claims.tenantId };
  }
  if (!roleHasFinanceCapability(claims.role, FINANCE_CAPABILITIES.READ)) {
    return { allowed: false, reason: 'role', role: claims.role, sessionTenantId: claims.tenantId };
  }
  return { allowed: true, reason: null, role: claims.role, sessionTenantId: claims.tenantId };
}

import brandConfig from '@/brand.config.json';

const envTenant = import.meta.env.VITE_TENANT_ID;
const tenantId = envTenant || brandConfig.defaultTenantId || 'default';
const resolvedBrand = brandConfig.tenants?.[tenantId] || brandConfig.tenants?.default || {};

// Merge feature flags with BHF (default tenant) priority:
// If a flag is false in default, tenant cannot enable it.
const defaultFeatures = brandConfig.tenants?.[brandConfig.defaultTenantId || 'default']?.features || {};
const tenantFeatures = resolvedBrand.features || {};
const effectiveFeatures = {};
const allKeys = new Set([...Object.keys(defaultFeatures), ...Object.keys(tenantFeatures)]);
allKeys.forEach((key) => {
  const bhfVal = defaultFeatures[key];
  const tenantVal = tenantFeatures[key];
  if (bhfVal === false) {
    effectiveFeatures[key] = false;
  } else {
    effectiveFeatures[key] = tenantVal !== undefined ? tenantVal : bhfVal ?? true;
  }
});

export const FEATURES = effectiveFeatures;
export const ENABLE_TVG_FEATURES =
  effectiveFeatures.enableTVG || import.meta.env.VITE_ENABLE_TVG_FEATURES === 'true';

export const TENANT_ID = tenantId;
export const BRAND = resolvedBrand;
export const BRAND_CONFIG = brandConfig;


import brandConfig from '@/config/brand.config.json';

export const getTenantId = () => {
  // Use VITE_TENANT_ID from environment variables, or default to 'tvg'
  return import.meta.env.VITE_TENANT_ID || 'tvg';
};

export const getTenantConfig = () => {
  const tenantId = getTenantId();
  return brandConfig[tenantId] || brandConfig.tvg; // Fallback to 'tvg' if tenantId not found
};

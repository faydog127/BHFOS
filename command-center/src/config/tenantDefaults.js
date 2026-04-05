export const DEFAULT_TENANT_ID = (
  import.meta.env.VITE_DEFAULT_TENANT ||
  import.meta.env.VITE_TENANT_ID ||
  'tvg'
).toLowerCase();

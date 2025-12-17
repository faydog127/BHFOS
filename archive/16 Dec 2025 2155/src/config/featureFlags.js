
import brandConfig from './bhf.config.json';

// Get current Tenant ID from environment, default to 'default' (Factory)
const TENANT_ID = import.meta.env.VITE_TENANT_ID || 'default';

/**
 * Resolves the final feature flags based on BHF Priority Logic.
 * 
 * PRIORITY RULES:
 * 1. BHF Defaults (System Level) are the baseline.
 * 2. If BHF sets a flag to FALSE (OFF), it is OFF for everyone. Tenant cannot override.
 * 3. If BHF sets a flag to TRUE (ON), Tenant CAN override it to FALSE (OFF).
 * 4. Locked flags in BHF config cannot be changed by tenants (even if BHF is ON).
 */
const resolveFlags = () => {
  const defaults = brandConfig.bhf_defaults.features;
  const tenantConfig = brandConfig.tenants[TENANT_ID]?.features || {};
  
  const resolved = {};

  Object.keys(defaults).forEach(key => {
    const bhfSetting = defaults[key];
    const tenantValue = tenantConfig[key];

    // Rule: BHF Off = Always Off
    if (bhfSetting.value === false) {
      resolved[key] = false;
      return;
    }

    // Rule: Locked = Strict BHF Value
    if (bhfSetting.locked) {
      resolved[key] = bhfSetting.value;
      return;
    }

    // Rule: Tenant Override (Tenant can turn OFF an enabled feature)
    // If tenantValue is defined (true/false), use it. Otherwise use BHF default.
    resolved[key] = tenantValue !== undefined ? tenantValue : bhfSetting.value;
  });

  // Log conflict resolution for debugging in non-prod
  if (import.meta.env.DEV) {
    console.groupCollapsed(`[BHF Config] Resolved Flags for Tenant: ${TENANT_ID}`);
    console.log('BHF Defaults:', defaults);
    console.log('Tenant Overrides:', tenantConfig);
    console.log('Final Resolution:', resolved);
    console.groupEnd();
  }

  return resolved;
};

export const defaultFlags = resolveFlags();

// Helper to get module definitions
export const getModuleDefinitions = () => {
  return brandConfig.crm_modules_definition || [];
};

export const isFeatureEnabled = (flagName) => {
    return defaultFlags[flagName] !== false;
};

export const getEnabledModules = () => {
    const modules = getModuleDefinitions();
    return modules.filter(module => defaultFlags[module.flag] !== false);
};

export default defaultFlags;

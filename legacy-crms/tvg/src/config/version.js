/**
 * Single Source of Truth for System Versioning
 * This consolidates the App Version (Settings) and Diagnostics Version.
 * 
 * FREEZE STATE: ACTIVE
 * VERSION: v2.5.0-STABLE
 */

export const SYSTEM_VERSION = {
  // Semantic Versioning
  major: 2,
  minor: 5,
  patch: 0,
  
  // Release Metadata
  label: "Horizon Stable Release",
  codeName: "Horizon",
  buildDate: "2025-12-16",
  freezeDate: "2025-12-16T14:30:00Z",
  status: "STABLE-FROZEN",
  
  // Feature Flags implied by this version (Locked)
  features: {
    smartCallConsole: true,
    marketingEngine: true,
    systemDoctorV2: true,
    partnerPortal: true,
    multiTenancy: true
  },

  // Helper to format full string
  getFullVersion: () => `v${SYSTEM_VERSION.major}.${SYSTEM_VERSION.minor}.${SYSTEM_VERSION.patch}`,
  getDisplayString: () => `v${SYSTEM_VERSION.major}.${SYSTEM_VERSION.minor}.${SYSTEM_VERSION.patch} (${SYSTEM_VERSION.label}) [FROZEN]`,
  
  // Freeze Validation Helper
  isFrozen: () => true
};

export default SYSTEM_VERSION;
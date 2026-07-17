/**
 * Single Source of Truth for System Versioning.
 *
 * Consolidates the App Version (Settings) and Diagnostics Version, and exposes
 * the real build identity rather than a hardcoded frozen label.
 *
 * G2.3A change: previously this module hardcoded a frozen "v2.5.0 / 2025-12-16 /
 * STABLE-FROZEN" label and returned `isFrozen: () => true`, presenting a frozen
 * constant as if it were build truth. Build identity is now sourced from
 * injected build-time environment (Vite `import.meta.env`, populated by the
 * production build from a reviewed `VITE_` allowlist), with safe development
 * fallbacks. The authoritative, independently verifiable deployed identity is
 * the generated `dist/build-info.json` (see tools/generate-build-info.mjs and
 * tools/verify-build-info.mjs). No secret value is read here.
 */

// Read injected build-time values defensively so this module is also importable
// in plain Node contexts (tooling, tests) where `import.meta.env` is undefined.
const BUILD_ENV =
  (typeof import.meta !== 'undefined' && import.meta && import.meta.env) || {};

const DEV_FALLBACK_STAMP = 'dev-local';

// Injected build identity (all non-secret, from the reviewed VITE_ allowlist).
const injectedStamp = (BUILD_ENV.VITE_BUILD_STAMP || '').trim();
const injectedCommit = (BUILD_ENV.VITE_COMMIT_SHA || '').trim();
const injectedEnv = (BUILD_ENV.VITE_BUILD_ENV || BUILD_ENV.MODE || '').trim();

const BUILD_STAMP = injectedStamp || DEV_FALLBACK_STAMP;
const COMMIT_SHA = injectedCommit || 'unknown';
const ENVIRONMENT = injectedEnv || 'development';

// True only when a real build stamp was injected by a production build path.
const HAS_REAL_BUILD_IDENTITY = injectedStamp.length > 0;

export const SYSTEM_VERSION = {
  // Semantic Versioning
  major: 2,
  minor: 5,
  patch: 0,

  // Release Metadata
  label: "Horizon Release",
  codeName: "Horizon",

  // Real, non-secret build identity (injected at build time; dev fallbacks).
  buildStamp: BUILD_STAMP,
  commitSha: COMMIT_SHA,
  environment: ENVIRONMENT,
  hasRealBuildIdentity: HAS_REAL_BUILD_IDENTITY,

  // Feature flags retained for backward compatibility with existing consumers.
  features: {
    smartCallConsole: true,
    marketingEngine: true,
    systemDoctorV2: true,
    partnerPortal: true,
    multiTenancy: true
  },

  // Version string helpers
  getFullVersion: () => `v${SYSTEM_VERSION.major}.${SYSTEM_VERSION.minor}.${SYSTEM_VERSION.patch}`,
  getDisplayString: () =>
    `v${SYSTEM_VERSION.major}.${SYSTEM_VERSION.minor}.${SYSTEM_VERSION.patch} (${SYSTEM_VERSION.label}) · build ${BUILD_STAMP}`,

  // Build-identity helpers
  getBuildStamp: () => BUILD_STAMP,
  getCommitSha: () => COMMIT_SHA,
  getEnvironment: () => ENVIRONMENT,
  getBuildIdentity: () => ({
    version: `v${SYSTEM_VERSION.major}.${SYSTEM_VERSION.minor}.${SYSTEM_VERSION.patch}`,
    buildStamp: BUILD_STAMP,
    commitSha: COMMIT_SHA,
    environment: ENVIRONMENT,
    hasRealBuildIdentity: HAS_REAL_BUILD_IDENTITY,
  }),

  // The system is no longer frozen; build identity is live, not a constant.
  // Retained for backward compatibility with existing callers.
  isFrozen: () => false
};

export default SYSTEM_VERSION;

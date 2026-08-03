/**
 * MIL plane identity for UI (plain language only — never expose project refs/secrets).
 *
 * Ratified production plane: mil.bhfos.com → sdzhdupekcnekesbtxsl
 * CRM production remains: app.bhfos.com → wwyxohjnyqnegzbxtuxs
 */

export const MIL_PRODUCTION_LABEL = 'MIL Production';
export const CRM_PRODUCTION_LABEL = 'CRM Production';

/** Build-info environment values that mean the MIL production host. */
const MIL_PRODUCTION_ENVS = new Set(['mil-production', 'mil-staging']);

/**
 * @param {{ environment?: string, hostname?: string } | null} buildInfo
 * @param {string} [hostname]
 */
export function resolveMilEnvironmentLabel(buildInfo, hostname = typeof window !== 'undefined' ? window.location.hostname : '') {
  const host = String(hostname || '').toLowerCase();
  const env = String(buildInfo?.environment || '').toLowerCase();

  if (host === 'mil.bhfos.com' || MIL_PRODUCTION_ENVS.has(env)) {
    return MIL_PRODUCTION_LABEL;
  }
  if (host === 'app.bhfos.com' || env === 'production') {
    return CRM_PRODUCTION_LABEL;
  }
  if (env && env !== 'unknown') {
    // Development / CI — still plain language, no refs.
    return env === 'development' || env === 'ci' ? 'MIL Development' : `MIL (${env})`;
  }
  return null;
}

/** Owner/admin-visible indicator; never includes Supabase project refs. */
export function shouldShowMilEnvironmentIndicator(caps) {
  return Boolean(caps?.isOwnerAdmin);
}

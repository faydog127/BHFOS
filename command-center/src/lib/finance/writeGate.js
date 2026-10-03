/**
 * Finance writes stay off unless this build is local or an explicit flag
 * marks an approved synthetic-only environment. No remote host is consulted.
 */
export const FINANCE_SYNTHETIC_ONLY = 'approved-synthetic';
export const FINANCE_WRITES_DISABLED = 'finance_writes_disabled';

function currentFinanceBuildEnv() {
  const env = typeof import.meta !== 'undefined' && import.meta ? import.meta.env : undefined;
  if (!env) return {};
  return env;
}

export function financeWritesEnabled(env) {
  const source = env === undefined ? currentFinanceBuildEnv() : env;
  const flag = typeof source.VITE_FINANCE_SYNTHETIC_ONLY === 'string'
    ? source.VITE_FINANCE_SYNTHETIC_ONLY.trim()
    : '';
  if (flag === FINANCE_SYNTHETIC_ONLY) return true;
  if (source.local === true) return true;
  if (source.DEV === true) return true;
  if (source.MODE === 'development' || source.MODE === 'test') return true;
  return false;
}

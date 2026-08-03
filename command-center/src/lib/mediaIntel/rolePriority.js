/**
 * Shared MIL role priority + deterministic total order.
 * Must stay aligned with SQL mil_current_role (Phase 2A Migration A) and edge milRoles.ts.
 *
 * Ordering (all layers identical):
 *   1. normalized priority ASC (lower wins)
 *   2. created_at DESC NULLS LAST
 *   3. row id DESC (stable unique key; missing id sorts as empty string)
 */

export const MIL_ROLE_PRIORITY = Object.freeze({
  admin: 1,
  manager: 2,
  media_reviewer: 3,
  office: 4,
  reel_creator: 5,
  phone_uploader: 6,
  technician: 7,
});

export function normalizeMilRole(role) {
  const r = String(role || '').toLowerCase().trim();
  if (['admin', 'super_admin', 'owner'].includes(r)) return 'admin';
  if (r === 'manager') return 'manager';
  if (['office', 'csr'].includes(r)) return 'office';
  if (['media_reviewer', 'reviewer'].includes(r)) return 'media_reviewer';
  if (['reel_creator', 'creator', 'contributor'].includes(r)) return 'reel_creator';
  if (['phone_uploader', 'uploader'].includes(r)) return 'phone_uploader';
  if (['technician', 'tech'].includes(r)) return 'technician';
  return 'unauthenticated';
}

function createdAtSortKey(createdAt) {
  if (createdAt == null || createdAt === '') return null;
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) ? t : null;
}

function idSortKey(id) {
  return id == null ? '' : String(id);
}

/**
 * Compare two role rows for total order. Negative means `a` wins over `b`.
 */
export function compareMilRoleRows(a, b) {
  const roleA = normalizeMilRole(a?.role);
  const roleB = normalizeMilRole(b?.role);
  const priA = roleA === 'unauthenticated' ? 99 : (MIL_ROLE_PRIORITY[roleA] ?? 99);
  const priB = roleB === 'unauthenticated' ? 99 : (MIL_ROLE_PRIORITY[roleB] ?? 99);
  if (priA !== priB) return priA - priB;

  const tsA = createdAtSortKey(a?.created_at);
  const tsB = createdAtSortKey(b?.created_at);
  // DESC NULLS LAST: non-null beats null; higher timestamp wins
  if (tsA == null && tsB == null) {
    /* fall through to id */
  } else if (tsA == null) {
    return 1; // a loses (NULLS LAST in DESC)
  } else if (tsB == null) {
    return -1;
  } else if (tsA !== tsB) {
    return tsB - tsA; // DESC
  }

  const idA = idSortKey(a?.id);
  const idB = idSortKey(b?.id);
  if (idA === idB) return 0;
  return idA < idB ? 1 : -1; // DESC
}

/**
 * Pure resolver over app_user_roles rows.
 * @param {Array<{ id?: string, role?: string, created_at?: string|null }>} rows
 */
export function resolveMilRoleFromRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 'unauthenticated';
  let best = null;
  for (const row of rows) {
    const role = normalizeMilRole(row?.role);
    if (role === 'unauthenticated') continue;
    if (!best || compareMilRoleRows(row, best) < 0) {
      best = { ...row, role };
    }
  }
  return best ? normalizeMilRole(best.role) : 'unauthenticated';
}

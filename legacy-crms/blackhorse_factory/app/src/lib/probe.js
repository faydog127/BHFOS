import { createClient } from '@supabase/supabase-js';

/**
 * Safely probes a table handling namespaced schemas (e.g., "communications.calls").
 * Returns a normalized result so the UI can distinguish "exists but blocked" from "missing".
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} fullTableName - "schema.table" or "table"
 * @returns {Promise<{exists: boolean, accessible: boolean, count: number, status: number, message?: string}>}
 */
export const probeTableSafetyCheck = async (supabase, fullTableName) => {
  const parts = fullTableName.split('.');
  let queryBuilder;

  if (parts.length === 2) {
    queryBuilder = supabase.schema(parts[0]).from(parts[1]);
  } else {
    queryBuilder = supabase.from(fullTableName);
  }

  const { count, error, status } = await queryBuilder.select('*', { count: 'exact', head: true });

  if (error) {
    if (status === 401) {
      // Table exists but RLS blocks us.
      return { exists: true, accessible: false, count: 0, status };
    }
    // 404/406 or other errors -> likely missing or misconfigured.
    return { exists: false, accessible: false, count: 0, status, message: error.message };
  }

  return { exists: true, accessible: true, count: count || 0, status };
};

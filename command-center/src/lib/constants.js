function projectIdFromEnv() {
  try {
    const u = import.meta.env?.VITE_SUPABASE_URL || '';
    const m = String(u).match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
    if (m?.[1]) return m[1];
  } catch {
    /* ignore */
  }
  return '';
}

/** Active Supabase project ref from VITE_SUPABASE_URL (no hardcoded production fallback in MIL builds). */
export const SUPABASE_PROJECT_ID = projectIdFromEnv();

export const LEAD_CAPTURE_API_URL = SUPABASE_PROJECT_ID
  ? `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/leads`
  : '';

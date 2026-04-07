import { supabase } from '@/lib/customSupabaseClient';

const requireAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const accessToken = data?.session?.access_token || null;
  if (!accessToken) {
    throw new Error('Not signed in (missing access token). Please refresh and sign in again.');
  }

  return accessToken;
};

const invokeAuthed = async (name, body) => {
  const accessToken = await requireAccessToken();
  return supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
};

const extractFunctionsErrorMessage = async (error) => {
  const message = error?.message ? String(error.message) : '';
  const context = error?.context;
  if (!context) return message || 'Edge Function error';

  try {
    const res = typeof context.clone === 'function' ? context.clone() : context;
    const data = await res.json();
    if (data?.error) return String(data.error);
    if (data?.message) return String(data.message);
    return JSON.stringify(data);
  } catch {
    try {
      const res = typeof context.clone === 'function' ? context.clone() : context;
      const text = await res.text();
      return text || message || 'Edge Function error';
    } catch {
      return message || 'Edge Function error';
    }
  }
};

const unwrap = async (result) => {
  if (result?.error) {
    const msg = await extractFunctionsErrorMessage(result.error);
    throw new Error(msg);
  }
  if (result?.data?.error) throw new Error(result.data.error);
  return result?.data || null;
};

export const opsProjectsService = {
  async list() {
    const result = await invokeAuthed('ops-projects', { action: 'list' });
    const data = await unwrap(result);
    return data?.projects || [];
  },

  async upsert(project) {
    const result = await invokeAuthed('ops-projects', { action: 'upsert', project });
    const data = await unwrap(result);
    return data?.project || null;
  },

  async remove(id) {
    const result = await invokeAuthed('ops-projects', { action: 'delete', id });
    await unwrap(result);
  },
};

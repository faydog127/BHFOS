import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const resolveFunctionsBaseUrl = (url) => {
  if (!url) return null;

  return `${url.replace(/\/$/, '')}/functions/v1`;
};
const functionsBaseUrl = resolveFunctionsBaseUrl(supabaseUrl);

const normalizeItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...item,
    id: item.id || `${item.entity_type}:${item.entity_id}`,
  }));
};

export const useKanbanBoardData = () => {
  const { activeTenantId } = useSupabaseAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const invokeWithAuth = useCallback(async (functionName, body) => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (sessionError || !accessToken) {
        return {
          data: null,
          error: new Error(sessionError?.message || 'Missing session token. Please sign in again.'),
        };
      }

      if (!functionsBaseUrl || !supabaseAnonKey) {
        return {
          data: null,
          error: new Error('Missing Supabase URL or anon key.'),
        };
      }

      const invoke = async (token) => {
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        let response;
        try {
          response = await fetch(`${functionsBaseUrl}/${functionName}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body ?? {}),
            signal: controller.signal,
          });
        } catch (networkError) {
          const message =
            networkError instanceof Error ? networkError.message : 'Network request failed';
          return { data: null, error: new Error(message) };
        } finally {
          clearTimeout(timeout);
        }

        const text = await response.text();
        let payload = null;

        if (text) {
          try {
            payload = JSON.parse(text);
          } catch {
            payload = { error: text };
          }
        }

        if (!response.ok) {
          return {
            data: payload,
            error: new Error(payload?.error || payload?.message || `Edge error: ${response.status}`),
          };
        }

        return { data: payload, error: null };
      };

      let response = await invoke(accessToken);

      if (response.error?.message?.toLowerCase().includes('invalid jwt')) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        const refreshedToken = refreshed?.session?.access_token;

        if (!refreshError && refreshedToken) {
          response = await invoke(refreshedToken);
        }
      }

      return response;
    } catch (unexpectedError) {
      const message =
        unexpectedError instanceof Error ? unexpectedError.message : 'Unexpected edge invocation error';
      return { data: null, error: new Error(message) };
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await invokeWithAuth('kanban-list', {});

    if (fetchError || data?.error) {
      setError(fetchError?.message || data?.error || 'Failed to load kanban board.');
      setItems([]);
      setLoading(false);
      return;
    }

    setItems(normalizeItems(data?.items || []));
    setLoading(false);
  }, []);

  const moveItem = useCallback(
    async ({ item, toColumnKey }) => {
      const snapshot = itemsRef.current;

      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? { ...entry, column_key: toColumnKey, sort_ts: new Date().toISOString() }
            : entry
        )
      );

      const { data, error: moveError } = await invokeWithAuth('kanban-move', {
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        to_column_key: toColumnKey,
      });

      if (moveError || data?.error) {
        setItems(snapshot);
        return { ok: false, error: moveError?.message || data?.error || 'Move failed.' };
      }

      await refresh();
      return { ok: true, data };
    },
    [invokeWithAuth, refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!activeTenantId) return;

    const handleChange = () => {
      refresh();
    };

    const channel = supabase
      .channel(`kanban-board:${activeTenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `tenant_id=eq.${activeTenantId}` }, handleChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes', filter: `tenant_id=eq.${activeTenantId}` }, handleChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `tenant_id=eq.${activeTenantId}` }, handleChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `tenant_id=eq.${activeTenantId}` }, handleChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTenantId, refresh]);

  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 30000);

    return () => clearInterval(interval);
  }, [refresh]);

  return {
    items,
    loading,
    error,
    refresh,
    moveItem,
    setItems,
  };
};

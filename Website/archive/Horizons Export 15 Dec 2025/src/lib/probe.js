
import { supabase } from './supabaseClient';

/**
 * Safely checks if a table exists and is accessible.
 * Strategies:
 * 1. Try 'system_doctor_check_table' RPC (best for schema.table support)
 * 2. Fallback to client-side HEAD request (best for public tables)
 */
export async function probeTableSafetyCheck(tableName) {
  try {
    // 1. Try RPC first if available (handles schema syntax like "communications.calls")
    const { data: rpcData, error: rpcError } = await supabase.rpc('system_doctor_check_table', { 
      p_table_name: tableName 
    });

    if (!rpcError && rpcData) {
      return {
        exists: rpcData.exists,
        accessible: true, // If RPC ran, we have access
        count: rpcData.row_count || 0,
        status: rpcData.status || 'ok',
        message: rpcData.status === 'missing' ? 'Table not found' : 'Accessible via RPC'
      };
    }

    // 2. Fallback to client-side select for standard tables (public schema only usually)
    // We utilize 'head: true' to just check existence/permission without fetching data
    // Note: Supabase client .from() typically doesn't support "schema.table" syntax unless configured,
    // so this fallback is mostly for "public.table" or just "table".
    const cleanName = tableName.includes('.') ? tableName.split('.')[1] : tableName;
    
    const { count, error } = await supabase
      .from(cleanName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      // Permission denied is technically "exists" but "not accessible"
      if (error.code === '42501') {
         return { exists: true, accessible: false, count: null, status: 'warning', message: 'Permission denied (RLS active)' };
      }
      // Undefined table
      if (error.code === '42P01') {
         return { exists: false, accessible: false, count: 0, status: 'error', message: 'Table does not exist' };
      }
      // Other errors
      return { exists: false, accessible: false, count: 0, status: 'error', message: error.message };
    }

    return {
      exists: true,
      accessible: true,
      count: count || 0,
      status: 'ok',
      message: 'Active (Direct Client Access)'
    };

  } catch (err) {
    console.error(`Probe failed for ${tableName}:`, err);
    return {
      exists: false,
      accessible: false,
      count: 0,
      status: 'error',
      message: err.message || 'Probe failed'
    };
  }
}

/**
 * Checks if an environment variable exists (Client-side only)
 */
export async function probeEnvironmentKey(keyName) {
    // We can only check VITE_ prefixed vars on client, 
    // BUT we can check if certain features are initialized in config.
    // For this mock, we return 'unknown' for server-side keys to avoid confusion,
    // or check if specific context providers are active.
    
    // Actually, we can check if the Supabase client URL is set
    if (keyName === 'SUPABASE_URL') {
         const url = import.meta.env.VITE_SUPABASE_URL;
         return { exists: !!url, key: keyName, status: url ? 'ok' : 'missing' };
    }
    if (keyName === 'SUPABASE_ANON_KEY') {
         const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
         return { exists: !!key, key: keyName, status: key ? 'ok' : 'missing' };
    }

    // For others, we assume missing on client side security
    return {
        exists: false,
        key: keyName,
        status: 'hidden',
        message: 'Server-side key (hidden from client)'
    };
}

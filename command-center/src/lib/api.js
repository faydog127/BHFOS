import { supabase } from '@/lib/customSupabaseClient';

/**
 * Invokes a Supabase Edge Function publicly using the anon key.
 * This replaces the previous `invokeWithAuth` function.
 * @param {string} functionName - The name of the Edge Function.
 * @param {object} [options] - Optional fetch options (e.g., body).
 * @returns {Promise<{ ok: boolean, data?: any, error?: string }>}
 */
export async function invoke(functionName, options = {}) {
    const { data, error } = await supabase.functions.invoke(functionName, {
        ...options,
        headers: {
            ...options.headers,
            'Content-Type': 'application/json',
            // The anon key is automatically included by the supabase client
        }
    });

    if (error) {
        console.error(`Error invoking function '${functionName}':`, error);
        return { ok: false, error: error.message };
    }
    
    // Edge functions can return structured errors even on success
    if (data && data.error) {
       return { ok: false, error: data.error };
    }

    return { ok: true, data };
}

/**
 * Logs a sales action and sends a templated message.
 * This function is a critical part of the AI Copilot workflow.
 * @param {object} payload - The data for the action.
 * @returns {Promise<{ ok: boolean, data?: any, error?: string }>}
 */
export async function logAndSendAction(payload) {
    return invoke('smartdocs-send', {
        body: JSON.stringify(payload)
    });
}
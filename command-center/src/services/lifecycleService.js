import { supabase } from '@/lib/customSupabaseClient';

/**
 * Service to interact with the Lifecycle Brain (Database RPC).
 * This is the ONLY approved entry point for promoting Accounts or Partners.
 */
export const lifecycleService = {
  /**
   * Promotes an account to a new lifecycle stage (e.g. Prospect -> Partner).
   * Invokes the 'promote_account_lifecycle' RPC function which handles:
   * 1. Chaos Flag Validation (Kill Switch)
   * 2. Atomic Updates of Account and Leads
   * 3. Audit Logging
   * 
   * @param {string} accountId - UUID of the account
   * @param {string} targetCategory - 'partner' | 'customer' | 'prospect'
   * @param {string} targetStatus - Specific status string (e.g. 'ACTIVE', 'ONBOARDING')
   * @returns {Promise<{success: boolean, error?: string, code?: string, data?: any}>}
   */
  async promoteAccount(accountId, targetCategory, targetStatus) {
    try {
      // Call the "Brain" function
      const { data, error } = await supabase.rpc('promote_account_lifecycle', {
        p_account_id: accountId,
        p_target_category: targetCategory,
        p_target_status: targetStatus
      });

      if (error) throw error;
      
      // The function returns a JSON object with success status
      if (!data.success) {
        return { 
          success: false, 
          error: data.error, 
          code: data.code // e.g. 'CHAOS_ACTIVE'
        };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Lifecycle Promotion Failed:', err);
      return { success: false, error: err.message || 'Internal System Error' };
    }
  },

  /**
   * Fetches the history of lifecycle changes for an account.
   * Useful for auditing when and why a status changed.
   * @param {string} accountId 
   */
  async getLifecycleHistory(accountId) {
    const { data, error } = await supabase
      .from('lifecycle_events')
      .select('*')
      .eq('account_id', accountId)
      .order('promoted_at', { ascending: false });

    if (error) throw error;
    return data;
  }
};
/**
 * ML-P1 Slice 6 — payment settings + refund / recon client facade.
 */

const rpcError = (error, fallback) => {
  const err = new Error(error?.message || fallback);
  err.code = error?.code || 'ML_P1_S6_RPC_ERROR';
  throw err;
};

const newMutationId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `s6-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function createMlP1S6PaymentService({ supabase } = {}) {
  if (!supabase) throw new Error('mlP1S6PaymentService requires supabase');

  return {
    getFlags: async () => {
      const { data, error } = await supabase.rpc('ml_p1_s6_payment_flags');
      if (error) rpcError(error, 'Load payment flags failed');
      return data || {};
    },

    setFlags: async (flags) => {
      const { data, error } = await supabase.rpc('ml_p1_s6_set_payment_flags', {
        p_flags: flags,
      });
      if (error) rpcError(error, 'Save payment flags failed');
      return data;
    },

    recordRefund: async (invoiceId, amount, reason, { providerRefundId = null, clientMutationId = null } = {}) => {
      const { data, error } = await supabase.rpc('ml_p1_s6_record_refund', {
        p_invoice_id: invoiceId,
        p_amount: amount,
        p_reason: reason,
        p_client_mutation_id: clientMutationId || newMutationId(),
        p_provider_refund_id: providerRefundId,
      });
      if (error) rpcError(error, 'Refund failed');
      return data;
    },

    listReconOpen: async (limit = 50) => {
      const { data, error } = await supabase
        .from('payment_recon_queue')
        .select('id, invoice_id, event_type, reason, provider_payment_id, status, created_at, payload')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) rpcError(error, 'Load recon queue failed');
      return data || [];
    },
  };
}

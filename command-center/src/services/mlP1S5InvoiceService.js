/**
 * ML-P1 Slice 5 — client facade for canonical invoice RPCs.
 * No direct invoices inserts. No Stripe.
 */

const newMutationId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `s5-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const rpcError = (error, fallback) => {
  const err = new Error(error?.message || fallback);
  err.code = error?.code || 'ML_P1_S5_RPC_ERROR';
  err.details = error?.details;
  throw err;
};

export function createMlP1S5InvoiceService({ supabase } = {}) {
  if (!supabase) throw new Error('mlP1S5InvoiceService requires supabase');

  return {
    readiness: async (jobId) => {
      const { data, error } = await supabase.rpc('ml_p1_s5_invoice_readiness', {
        p_job_id: jobId,
      });
      if (error) rpcError(error, 'Invoice readiness failed');
      return data;
    },

    create: async (jobId, { clientMutationId = null, system = false } = {}) => {
      const { data, error } = await supabase.rpc('ml_p1_s5_invoice_create', {
        p_job_id: jobId,
        p_client_mutation_id: clientMutationId || newMutationId(),
        p_system: Boolean(system),
      });
      if (error) rpcError(error, 'Invoice create failed');
      return data;
    },

    draftUpdate: async (
      invoiceId,
      { taxRate = null, taxAmount = null, discountAmount = null, notes = null, clientMutationId = null } = {},
    ) => {
      const { data, error } = await supabase.rpc('ml_p1_s5_invoice_draft_update', {
        p_invoice_id: invoiceId,
        p_client_mutation_id: clientMutationId || newMutationId(),
        p_tax_rate: taxRate,
        p_tax_amount: taxAmount,
        p_discount_amount: discountAmount,
        p_notes: notes,
      });
      if (error) rpcError(error, 'Draft update failed');
      return data;
    },

    issue: async (invoiceId, { clientMutationId = null } = {}) => {
      const { data, error } = await supabase.rpc('ml_p1_s5_invoice_issue', {
        p_invoice_id: invoiceId,
        p_client_mutation_id: clientMutationId || newMutationId(),
      });
      if (error) rpcError(error, 'Issue failed');
      return data;
    },

    void: async (invoiceId, reason, { clientMutationId = null } = {}) => {
      const { data, error } = await supabase.rpc('ml_p1_s5_invoice_void', {
        p_invoice_id: invoiceId,
        p_client_mutation_id: clientMutationId || newMutationId(),
        p_reason: reason,
      });
      if (error) rpcError(error, 'Void failed');
      return data;
    },

    getByJob: async (jobId) => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, status, invoice_number, total_amount, tax_amount, tax_rate, discount_amount, subtotal, amount_paid, sent_at, void_reason, s5_created, created_at')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) rpcError(error, 'Load invoices failed');
      return data || [];
    },
  };
}

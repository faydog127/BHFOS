import { supabase } from '@/lib/supabaseClient';
import {
  LEAD_ADDRESS_SELECT,
  normalizeLeadRecord,
  resolveLegacyServiceAddress,
} from '@/lib/inspectionFieldAddress';

/**
 * Payment / invoice retrieval.
 *
 * Never embed leads→properties. Production does not expose a valid
 * leads.property_id → properties.id relationship.
 */

const INVOICE_LEAD_SELECT = `lead:leads!fk_invoices_lead(${LEAD_ADDRESS_SELECT})`;

const attachResolvedServiceAddress = (invoice) => {
  if (!invoice) return invoice;
  const lead = normalizeLeadRecord(
    Array.isArray(invoice.lead) ? invoice.lead[0] : invoice.lead,
  );
  const job = Array.isArray(invoice.job) ? invoice.job[0] : invoice.job;
  const serviceAddress = resolveLegacyServiceAddress({
    snapshotAddress: invoice.service_address || '',
    serviceAddress: job?.service_address || invoice.service_address || '',
    lead,
  });
  return {
    ...invoice,
    lead,
    job: job || null,
    resolved_service_address: serviceAddress || null,
  };
};

export const paymentService = {
  /**
   * Get invoice by public token for payment page
   */
  async getInvoiceByToken(token) {
    if (!token) throw new Error('Token is required');

    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        items:invoice_items(*),
        ${INVOICE_LEAD_SELECT},
        organization:organizations(*),
        job:jobs!fk_invoices_job(job_number, status, service_address),
        estimate:estimates!fk_invoices_estimate(estimate_number)
      `)
      .eq('public_token', token)
      .single();

    if (error) throw error;
    return attachResolvedServiceAddress(data);
  },

  /**
   * Get invoice by ID (Authenticated)
   */
  async getInvoiceById(id) {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        items:invoice_items(*),
        ${INVOICE_LEAD_SELECT},
        account:accounts!fk_invoices_account(id, name, type),
        job:jobs!fk_invoices_job(id, job_number, status, service_address),
        quote:quotes!fk_invoices_quote(*),
        estimate:estimates!fk_invoices_estimate(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return attachResolvedServiceAddress(data);
  },

  /**
   * Process a payment (Mock or Stripe integration point)
   */
  async processPayment(token, amount, method, metadata = {}) {
    // 1. Verify invoice exists
    const invoice = await this.getInvoiceByToken(token);
    if (!invoice) throw new Error('Invoice not found');

    if (invoice.balance_due < amount) {
       // Allow it for now, but strictly this should be a validation error in some systems
       console.warn('Payment amount exceeds balance due');
    }

    // 2. Call Supabase RPC to handle transaction safely (financial authority unchanged)
    const { data, error } = await supabase.rpc('process_public_payment', {
      p_token: token,
      p_amount: amount,
      p_method: method,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Fetch all transactions for an invoice
   */
  async getTransactions(invoiceId) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
};

import { supabase } from '@/lib/supabaseClient';

/**
 * Service to handle payment processing and invoice retrieval
 * explicitly using the new Foreign Key naming conventions to avoid ambiguity.
 */

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
        lead:leads!fk_invoices_lead(
          id, 
          first_name, 
          last_name, 
          email, 
          phone, 
          company,
          property:properties!fk_leads_property(
            address1, 
            city, 
            state, 
            zip
          )
        ),
        organization:organizations(*),
        job:jobs!fk_invoices_job(job_number, status),
        estimate:estimates!fk_invoices_estimate(estimate_number)
      `)
      .eq('public_token', token)
      .single();

    if (error) throw error;
    return data;
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
        lead:leads!fk_invoices_lead(*),
        account:accounts!fk_invoices_account(id, name, type),
        property:properties!fk_invoices_property(*),
        job:jobs!fk_invoices_job(*),
        quote:quotes!fk_invoices_quote(*),
        estimate:estimates!fk_invoices_estimate(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
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

    // 2. Call Supabase RPC to handle transaction safely
    const { data, error } = await supabase.rpc('process_public_payment', {
      p_token: token,
      p_amount: amount,
      p_method: method
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
  }
};
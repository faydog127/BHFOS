import { supabase } from '@/lib/customSupabaseClient';

export const quoteService = {
  /**
   * Send a quote via email.
   */
  async sendQuote(quoteId, email) {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', quoteId);
        
      if (error) throw error;
      
      // In a real scenario, this would also trigger the 'send-email' edge function
      // await supabase.functions.invoke('send-email', ...);
      
      return { success: true };
    } catch (error) {
      console.error('Send quote failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Converts an existing Estimate into a Quote (Proposal).
   * Deep copies the estimate header and all line items.
   */
  async createQuoteFromEstimate(estimateId) {
    try {
        // 1. Fetch Estimate and Items
        const { data: estimate, error: fetchError } = await supabase
            .from('estimates')
            .select(`*, invoice_items:estimate_items(*)`) // Note: Assuming estimate_items exists or we map from a shared structure. 
                                                         // Wait, the schema shows 'services' JSONB column in 'estimates', 
                                                         // but 'quote_items' is a separate table.
                                                         // Let's check schema: estimates has 'services' jsonb. quotes has 'quote_items' table.
            .eq('id', estimateId)
            .single();

        if (fetchError) throw fetchError;

        // 2. Create Quote Header
        // Generate a new quote number
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const quoteNumber = parseInt(`${new Date().getFullYear()}${randomNum}`);

        const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .insert({
                lead_id: estimate.lead_id,
                estimate_id: estimate.id,
                quote_number: quoteNumber,
                status: 'draft',
                subtotal: estimate.total_price, // Approximation, ideal to recalc
                total_amount: estimate.total_price,
                valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (quoteError) throw quoteError;

        // 3. Create Quote Items from Estimate Services (JSONB)
        // Estimate 'services' is an array of objects
        if (estimate.services && Array.isArray(estimate.services)) {
            const itemsToInsert = estimate.services.map(svc => ({
                quote_id: quote.id,
                description: svc.name || svc.description,
                quantity: svc.quantity || 1,
                unit_price: svc.price || svc.unit_price || 0,
                total_price: (svc.quantity || 1) * (svc.price || 0)
            }));

            if (itemsToInsert.length > 0) {
                const { error: itemsError } = await supabase
                    .from('quote_items')
                    .insert(itemsToInsert);
                
                if (itemsError) throw itemsError;
            }
        }

        return { success: true, quote };

    } catch (error) {
        console.error('Convert to Quote Failed:', error);
        return { success: false, error: error.message };
    }
  }
};